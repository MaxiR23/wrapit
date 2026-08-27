'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { archivedAdministeredByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import {
  deleteExpiredRestoreUndoTokens,
  newRestoreUndoTokenId,
  restoreUndoExpiresAt,
} from '@/lib/restoreUndo';
import {
  ACCOUNT_PATH,
  ARCHIVED_PATH,
  MY_TASKS_PATH,
  PROJECTS_PATH,
  projectPath,
} from '@/lib/routes';
import { restoreArchivedProjectsSchema } from '@/lib/validation/archived';

type RestoreArchivedProjectsResult =
  { data: { ids: string[]; undoToken: string } } | { error: string };

class BatchMismatchError extends Error {
  constructor() {
    super('Archived project restore occupancy conflict');
    this.name = 'BatchMismatchError';
  }
}

function revalidateRestoredProjects(ids: string[]) {
  revalidatePath(PROJECTS_PATH);
  revalidatePath(ARCHIVED_PATH);
  revalidatePath(MY_TASKS_PATH);
  revalidatePath(ACCOUNT_PATH);
  for (const id of ids) {
    revalidatePath(projectPath(id));
  }
}

export async function restoreArchivedProjects(input: {
  projectIds: string[];
}): Promise<RestoreArchivedProjectsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = restoreArchivedProjectsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const ids = parsed.data.projectIds;
  await deleteExpiredRestoreUndoTokens(prisma);

  try {
    const undoToken = newRestoreUndoTokenId();
    await prisma.$transaction(async (tx) => {
      const projects = await tx.project.findMany({
        where: { id: { in: ids }, ...archivedAdministeredByUser(session.user.id) },
        select: { id: true, title: true, archivedAt: true, archivedById: true },
      });
      if (projects.length !== ids.length) {
        throw new BatchMismatchError();
      }
      const snapshots = projects.map((project) => {
        if (project.archivedAt == null) {
          throw new BatchMismatchError();
        }
        return {
          id: project.id,
          archivedAt: project.archivedAt.toISOString(),
          archivedById: project.archivedById,
        };
      });

      const restored = await tx.project.updateMany({
        where: { id: { in: ids }, ...archivedAdministeredByUser(session.user.id) },
        data: { archivedAt: null, archivedById: null },
      });
      if (restored.count !== ids.length) {
        throw new BatchMismatchError();
      }

      const firstId = ids[0];
      if (firstId == null) {
        throw new BatchMismatchError();
      }

      await tx.restoreUndoToken.create({
        data: {
          id: undoToken,
          userId: session.user.id,
          projectId: firstId,
          kind: 'PROJECT',
          expiresAt: restoreUndoExpiresAt(),
          cards: snapshots,
        },
      });

      const titleById = new Map(projects.map((project) => [project.id, project.title]));
      const actor = activityActorFromSession(session.user);
      for (const id of ids) {
        await recordActivityEvent(tx, {
          projectId: id,
          actorId: session.user.id,
          type: 'PROJECT_RESTORED',
          payload: {
            ...actor,
            projectTitle: titleById.get(id) ?? id,
          },
        });
      }
    });

    revalidateRestoredProjects(ids);
    return { data: { ids, undoToken } };
  } catch (error) {
    if (error instanceof BatchMismatchError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
