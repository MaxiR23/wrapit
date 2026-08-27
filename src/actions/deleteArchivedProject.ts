'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { archivedAdministeredByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import { ACCOUNT_PATH, ARCHIVED_PATH, MY_TASKS_PATH, PROJECTS_PATH } from '@/lib/routes';
import { deleteArchivedProjectSchema } from '@/lib/validation/archived';

type DeleteArchivedProjectResult = { data: { id: string } } | { error: string };

class OccupancyError extends Error {
  constructor() {
    super('Archived project delete occupancy conflict');
    this.name = 'OccupancyError';
  }
}

export async function deleteArchivedProject(input: {
  projectId: string;
  title: string;
}): Promise<DeleteArchivedProjectResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = deleteArchivedProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...archivedAdministeredByUser(session.user.id) },
  });
  if (!project) {
    return { error: 'Unauthorized' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await recordActivityEvent(tx, {
        projectId: project.id,
        actorId: session.user.id,
        type: 'PROJECT_DELETED',
        payload: {
          ...activityActorFromSession(session.user),
          projectTitle: project.title,
        },
      });

      const deleted = await tx.project.deleteMany({
        where: {
          id: project.id,
          title: parsed.data.title,
          ...archivedAdministeredByUser(session.user.id),
        },
      });
      if (deleted.count !== 1) {
        throw new OccupancyError();
      }
    });

    revalidatePath(PROJECTS_PATH);
    revalidatePath(ARCHIVED_PATH);
    revalidatePath(MY_TASKS_PATH);
    revalidatePath(ACCOUNT_PATH);
    return { data: { id: project.id } };
  } catch (error) {
    if (error instanceof OccupancyError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
