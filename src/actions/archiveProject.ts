'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { administeredByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import {
  ACCOUNT_PATH,
  ARCHIVED_PATH,
  MY_TASKS_PATH,
  PROJECTS_PATH,
  projectPath,
} from '@/lib/routes';
import { archiveProjectSchema } from '@/lib/validation/archived';

type ArchiveProjectResult = { data: { id: string } } | { error: string };

class OccupancyError extends Error {
  constructor() {
    super('Project archive occupancy conflict');
    this.name = 'OccupancyError';
  }
}

function revalidateArchivedProject(projectId: string) {
  revalidatePath(PROJECTS_PATH);
  revalidatePath(projectPath(projectId));
  revalidatePath(ARCHIVED_PATH);
  revalidatePath(MY_TASKS_PATH);
  revalidatePath(ACCOUNT_PATH);
}

export async function archiveProject(input: { projectId: string }): Promise<ArchiveProjectResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = archiveProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...administeredByUser(session.user.id) },
  });
  if (!project) {
    return { error: 'Unauthorized' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const archived = await tx.project.updateMany({
        where: { id: project.id, ...administeredByUser(session.user.id) },
        data: { archivedAt: new Date(), archivedById: session.user.id },
      });
      if (archived.count !== 1) {
        throw new OccupancyError();
      }

      await recordActivityEvent(tx, {
        projectId: project.id,
        actorId: session.user.id,
        type: 'PROJECT_ARCHIVED',
        payload: {
          ...activityActorFromSession(session.user),
          projectTitle: project.title,
        },
      });
    });

    revalidateArchivedProject(project.id);
    return { data: { id: project.id } };
  } catch (error) {
    if (error instanceof OccupancyError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
