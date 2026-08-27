'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { administeredByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import { deleteExpiredRestoreUndoTokens } from '@/lib/restoreUndo';
import { MY_TASKS_PATH, projectArchivedPath, projectPath } from '@/lib/routes';
import { rearchiveArchivedCardsSchema, restoreUndoCardsSchema } from '@/lib/validation/archived';

type RearchiveArchivedCardsResult = { data: { ids: string[] } } | { error: string };

class UndoTokenError extends Error {
  constructor() {
    super('Restore undo token rejected');
    this.name = 'UndoTokenError';
  }
}

class BatchMismatchError extends Error {
  constructor() {
    super('Archived rearchive occupancy conflict');
    this.name = 'BatchMismatchError';
  }
}

export async function rearchiveArchivedCards(input: {
  token: string;
}): Promise<RearchiveArchivedCardsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = rearchiveArchivedCardsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  await deleteExpiredRestoreUndoTokens(prisma);

  try {
    const { ids, projectId } = await prisma.$transaction(async (tx) => {
      const row = await tx.restoreUndoToken.findFirst({
        where: {
          id: parsed.data.token,
          userId: session.user.id,
          expiresAt: { gt: new Date() },
        },
      });
      if (!row) {
        throw new UndoTokenError();
      }

      const snapshots = restoreUndoCardsSchema.safeParse(row.cards);
      if (!snapshots.success) {
        throw new UndoTokenError();
      }

      const project = await tx.project.findFirst({
        where: { id: row.projectId, ...administeredByUser(session.user.id) },
      });
      if (!project) {
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

      for (const snapshot of snapshots.data) {
        const written = await tx.card.updateMany({
          where: {
            id: snapshot.id,
            archivedAt: null,
            column: { projectId: project.id },
          },
          data: {
            archivedAt: snapshot.archivedAt,
            archivedById: snapshot.archivedById,
          },
        });
        if (written.count !== 1) {
          throw new BatchMismatchError();
        }
      }

      const cardIds = snapshots.data.map((snapshot) => snapshot.id);
      const cards = await tx.card.findMany({
        where: { id: { in: cardIds } },
        select: { id: true, title: true },
      });
      const titleById = new Map(cards.map((card) => [card.id, card.title]));
      const actor = activityActorFromSession(session.user);
      for (const id of cardIds) {
        await recordActivityEvent(tx, {
          projectId: project.id,
          actorId: session.user.id,
          type: 'CARD_ARCHIVED',
          payload: {
            ...actor,
            cardId: id,
            cardTitle: titleById.get(id) ?? id,
          },
        });
      }
      return { ids: cardIds, projectId: project.id };
    });

    revalidatePath(projectPath(projectId));
    revalidatePath(projectArchivedPath(projectId));
    revalidatePath(MY_TASKS_PATH);
    return { data: { ids } };
  } catch (error) {
    if (error instanceof UndoTokenError || error instanceof BatchMismatchError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
