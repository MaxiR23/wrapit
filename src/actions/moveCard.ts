'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getColumnForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { moveCardSchema } from '@/lib/validation/moveCard';

type MoveCardResult =
  | {
      data: {
        id: string;
        title: string;
        description: string | null;
        code: string;
        order: number;
        columnId: string;
      };
    }
  | { error: string };

export async function moveCard(input: {
  cardId: string;
  sourceColumnId: string;
  targetColumnId: string;
}): Promise<MoveCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const { cardId, sourceColumnId, targetColumnId } = parsed.data;

  const ownedSource = await getColumnForUser(sourceColumnId, session.user.id, 'EDIT');
  if (!ownedSource) {
    return { error: 'Unauthorized' };
  }

  const ownedTarget = await getColumnForUser(targetColumnId, session.user.id, 'EDIT');
  if (!ownedTarget) {
    return { error: 'Unauthorized' };
  }

  if (ownedSource.project.id !== ownedTarget.project.id) {
    return { error: 'Unauthorized' };
  }

  if (sourceColumnId === targetColumnId) {
    const card = await prisma.card.findFirst({
      where: { id: cardId, columnId: sourceColumnId },
    });
    if (!card) {
      return { error: 'Unauthorized' };
    }
    return {
      data: {
        id: card.id,
        title: card.title,
        description: card.description,
        code: typeof card.code === 'string' ? card.code : '',
        order: card.order,
        columnId: card.columnId,
      },
    };
  }

  try {
    const card = await prisma.$transaction(async (tx) => {
      const [last] = await tx.card.findMany({
        where: { columnId: ownedTarget.column.id },
        orderBy: { order: 'desc' },
        take: 1,
      });
      const order = (typeof last?.order === 'number' ? last.order : 0) + 1;

      const claimed = await tx.card.updateMany({
        where: { id: cardId, columnId: sourceColumnId },
        data: {
          columnId: ownedTarget.column.id,
          order,
        },
      });
      if (claimed.count !== 1) {
        throw new OccupancyError();
      }

      const moved = await tx.card.findFirst({ where: { id: cardId } });
      if (!moved) {
        throw new OccupancyError();
      }

      await recordActivityEvent(tx, {
        projectId: ownedTarget.project.id,
        actorId: session.user.id,
        type: 'CARD_MOVED',
        payload: {
          ...activityActorFromSession(session.user),
          cardId: moved.id,
          cardTitle: moved.title,
          fromColumnId: ownedSource.column.id,
          fromColumnTitle: ownedSource.column.title,
          toColumnId: ownedTarget.column.id,
          toColumnTitle: ownedTarget.column.title,
        },
      });

      return moved;
    });

    revalidatePath(projectPath(ownedTarget.project.id));

    return {
      data: {
        id: card.id,
        title: card.title,
        description: card.description,
        code: typeof card.code === 'string' ? card.code : '',
        order: card.order,
        columnId: card.columnId,
      },
    };
  } catch (error) {
    if (error instanceof OccupancyError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}

class OccupancyError extends Error {
  constructor() {
    super('Card occupancy conflict');
    this.name = 'OccupancyError';
  }
}
