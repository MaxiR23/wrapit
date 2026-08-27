'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import {
  GENERIC_ERROR_MESSAGE,
  MISSING_COLUMN_BATCH_MESSAGE,
  MISSING_COLUMN_MESSAGE,
} from '@/lib/messages';
import { administeredByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import {
  deleteExpiredRestoreUndoTokens,
  newRestoreUndoTokenId,
  restoreUndoExpiresAt,
} from '@/lib/restoreUndo';
import { MY_TASKS_PATH, projectArchivedPath, projectPath } from '@/lib/routes';
import { restoreArchivedCardsSchema } from '@/lib/validation/archived';

type RestoreArchivedCardsResult =
  { data: { ids: string[]; undoToken: string } } | { error: string };

class BatchMismatchError extends Error {
  constructor() {
    super('Archived restore occupancy conflict');
    this.name = 'BatchMismatchError';
  }
}

function revalidateArchived(projectId: string) {
  revalidatePath(projectPath(projectId));
  revalidatePath(projectArchivedPath(projectId));
  revalidatePath(MY_TASKS_PATH);
}

async function classifyRestoreFailure(ids: string[], projectId: string): Promise<string> {
  const cards = await prisma.card.findMany({
    where: { id: { in: ids } },
    select: { id: true, archivedAt: true, columnId: true },
  });
  if (cards.length !== ids.length) return 'Unauthorized';
  if (cards.some((card) => card.archivedAt == null)) return 'Unauthorized';

  const columns = await prisma.column.findMany({
    where: { id: { in: cards.map((card) => card.columnId) } },
    select: { id: true, projectId: true },
  });
  const reachable = new Set(
    columns.filter((column) => column.projectId === projectId).map((column) => column.id),
  );
  if (cards.some((card) => !reachable.has(card.columnId))) {
    return ids.length === 1 ? MISSING_COLUMN_MESSAGE : MISSING_COLUMN_BATCH_MESSAGE;
  }
  return 'Unauthorized';
}

export async function restoreArchivedCards(input: {
  projectId: string;
  cardIds: string[];
}): Promise<RestoreArchivedCardsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = restoreArchivedCardsSchema.safeParse(input);
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
  await deleteExpiredRestoreUndoTokens(prisma);

  try {
    const undoToken = newRestoreUndoTokenId();
    await prisma.$transaction(async (tx) => {
      const cards = await tx.card.findMany({
        where: {
          id: { in: ids },
          archivedAt: { not: null },
          column: { projectId: project.id },
        },
        select: { id: true, title: true, archivedAt: true, archivedById: true },
      });
      if (cards.length !== ids.length) {
        throw new BatchMismatchError();
      }
      const snapshots = cards.map((card) => {
        if (card.archivedAt == null) {
          throw new BatchMismatchError();
        }
        return {
          id: card.id,
          archivedAt: card.archivedAt.toISOString(),
          archivedById: card.archivedById,
        };
      });

      const restored = await tx.card.updateMany({
        where: {
          id: { in: ids },
          archivedAt: { not: null },
          column: { projectId: project.id },
        },
        data: { archivedAt: null, archivedById: null },
      });
      if (restored.count !== ids.length) {
        throw new BatchMismatchError();
      }

      await tx.restoreUndoToken.create({
        data: {
          id: undoToken,
          userId: session.user.id,
          projectId: project.id,
          expiresAt: restoreUndoExpiresAt(),
          cards: snapshots,
        },
      });

      const titleById = new Map(cards.map((card) => [card.id, card.title]));
      const actor = activityActorFromSession(session.user);
      for (const id of ids) {
        await recordActivityEvent(tx, {
          projectId: project.id,
          actorId: session.user.id,
          type: 'CARD_RESTORED',
          payload: {
            ...actor,
            cardId: id,
            cardTitle: titleById.get(id) ?? id,
          },
        });
      }
    });

    revalidateArchived(project.id);
    return { data: { ids, undoToken } };
  } catch (error) {
    if (error instanceof BatchMismatchError) {
      return { error: await classifyRestoreFailure(ids, project.id) };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
