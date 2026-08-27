'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { administeredByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import { MY_TASKS_PATH, projectArchivedPath, projectPath } from '@/lib/routes';
import { deleteArchivedCardsSchema } from '@/lib/validation/archived';

type DeleteArchivedCardsResult = { data: { ids: string[] } } | { error: string };

class BatchMismatchError extends Error {
  constructor() {
    super('Archived delete occupancy conflict');
    this.name = 'BatchMismatchError';
  }
}

export async function deleteArchivedCards(input: {
  projectId: string;
  cardIds: string[];
}): Promise<DeleteArchivedCardsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = deleteArchivedCardsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...administeredByUser(session.user.id) },
  });
  if (!project) {
    return { error: 'Unauthorized' };
  }

  const ids = parsed.data.cardIds;

  try {
    await prisma.$transaction(async (tx) => {
      const snapshots = await tx.card.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true },
      });
      const titleById = new Map(snapshots.map((card) => [card.id, card.title]));

      const deleted = await tx.card.deleteMany({
        where: {
          id: { in: ids },
          archivedAt: { not: null },
          column: { projectId: project.id },
        },
      });
      if (deleted.count !== ids.length) {
        throw new BatchMismatchError();
      }

      const actor = activityActorFromSession(session.user);
      for (const id of ids) {
        await recordActivityEvent(tx, {
          projectId: project.id,
          actorId: session.user.id,
          type: 'CARD_DELETED',
          payload: {
            ...actor,
            cardId: id,
            cardTitle: titleById.get(id) ?? id,
          },
        });
      }
    });

    revalidatePath(projectPath(project.id));
    revalidatePath(projectArchivedPath(project.id));
    revalidatePath(MY_TASKS_PATH);
    return { data: { ids } };
  } catch (error) {
    if (error instanceof BatchMismatchError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
