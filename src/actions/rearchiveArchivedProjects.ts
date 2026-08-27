'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { administeredByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import { deleteExpiredRestoreUndoTokens } from '@/lib/restoreUndo';
import {
  ACCOUNT_PATH,
  ARCHIVED_PATH,
  MY_TASKS_PATH,
  PROJECTS_PATH,
  projectPath,
} from '@/lib/routes';
import { rearchiveArchivedProjectsSchema, restoreUndoCardsSchema } from '@/lib/validation/archived';

type RearchiveArchivedProjectsResult = { data: { ids: string[] } } | { error: string };

class UndoTokenError extends Error {
  constructor() {
    super('Restore undo token rejected');
    this.name = 'UndoTokenError';
  }
}

class BatchMismatchError extends Error {
  constructor() {
    super('Archived project rearchive occupancy conflict');
    this.name = 'BatchMismatchError';
  }
}

export async function rearchiveArchivedProjects(input: {
  token: string;
}): Promise<RearchiveArchivedProjectsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = rearchiveArchivedProjectsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  await deleteExpiredRestoreUndoTokens(prisma);

  try {
    const ids = await prisma.$transaction(async (tx) => {
      const row = await tx.restoreUndoToken.findFirst({
        where: {
          id: parsed.data.token,
          userId: session.user.id,
          expiresAt: { gt: new Date() },
        },
      });
      if (!row || row.kind !== 'PROJECT') {
        throw new UndoTokenError();
      }

      const snapshots = restoreUndoCardsSchema.safeParse(row.cards);
      if (!snapshots.success) {
        throw new UndoTokenError();
      }

      const projectIds = snapshots.data.map((snapshot) => snapshot.id);
      const administered = await tx.project.findMany({
        where: { id: { in: projectIds }, ...administeredByUser(session.user.id) },
        select: { id: true },
      });
      if (administered.length !== projectIds.length) {
        throw new UndoTokenError();
      }

      const consumed = await tx.restoreUndoToken.deleteMany({
        where: {
          id: row.id,
          userId: session.user.id,
          expiresAt: { gt: new Date() },
        },
      });
      if (consumed.count !== 1) {
        throw new UndoTokenError();
      }

      const titles = await tx.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, title: true },
      });
      const titleById = new Map(titles.map((project) => [project.id, project.title]));
      const actor = activityActorFromSession(session.user);

      for (const snapshot of snapshots.data) {
        const written = await tx.project.updateMany({
          where: {
            id: snapshot.id,
            archivedAt: null,
            memberships: { some: { userId: session.user.id, role: { in: ['OWNER', 'ADMIN'] } } },
          },
          data: {
            archivedAt: snapshot.archivedAt,
            archivedById: snapshot.archivedById,
          },
        });
        if (written.count !== 1) {
          throw new BatchMismatchError();
        }
        await recordActivityEvent(tx, {
          projectId: snapshot.id,
          actorId: session.user.id,
          type: 'PROJECT_ARCHIVED',
          payload: {
            ...actor,
            projectTitle: titleById.get(snapshot.id) ?? snapshot.id,
          },
        });
      }
      return projectIds;
    });

    revalidatePath(PROJECTS_PATH);
    revalidatePath(ARCHIVED_PATH);
    revalidatePath(MY_TASKS_PATH);
    revalidatePath(ACCOUNT_PATH);
    for (const id of ids) {
      revalidatePath(projectPath(id));
    }
    return { data: { ids } };
  } catch (error) {
    if (error instanceof UndoTokenError || error instanceof BatchMismatchError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
