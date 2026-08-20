'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { orderBetween } from '@/lib/order';
import { getCardForUser, getColumnForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { moveCardSchema, type MoveCardFieldErrors } from '@/lib/validation/moveCard';

type MoveCardResult =
  | {
      data: {
        id: string;
        title: string;
        description: string | null;
        order: number;
        columnId: string;
      };
    }
  | { fieldErrors: MoveCardFieldErrors }
  | { error: string };

export async function moveCard(input: {
  cardId: string;
  targetColumnId: string;
  beforeCardId: string | null;
  afterCardId: string | null;
}): Promise<MoveCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const { cardId, targetColumnId, beforeCardId, afterCardId } = parsed.data;

  const ownedCard = await getCardForUser(cardId, session.user.id);
  if (!ownedCard) {
    return { error: 'Unauthorized' };
  }

  const ownedTarget = await getColumnForUser(targetColumnId, session.user.id);
  if (!ownedTarget) {
    return { error: 'Unauthorized' };
  }

  if (ownedCard.project.id !== ownedTarget.project.id) {
    return { error: 'Unauthorized' };
  }

  try {
    let beforeOrder: number | null = null;
    let afterOrder: number | null = null;

    if (beforeCardId !== null) {
      if (beforeCardId === cardId) {
        return { error: 'Unauthorized' };
      }
      const beforeCard = await prisma.card.findFirst({
        where: { id: beforeCardId, columnId: ownedTarget.column.id },
      });
      if (!beforeCard) {
        return { error: 'Unauthorized' };
      }
      beforeOrder = beforeCard.order;
    }

    if (afterCardId !== null) {
      if (afterCardId === cardId) {
        return { error: 'Unauthorized' };
      }
      const afterCard = await prisma.card.findFirst({
        where: { id: afterCardId, columnId: ownedTarget.column.id },
      });
      if (!afterCard) {
        return { error: 'Unauthorized' };
      }
      afterOrder = afterCard.order;
    }

    const order = orderBetween(beforeOrder, afterOrder);

    if (order == null) {
      const card = await renumberColumnInserting({
        columnId: ownedTarget.column.id,
        cardId,
        beforeCardId,
        afterCardId,
      });
      revalidatePath(projectPath(ownedTarget.project.id));
      return { data: card };
    }

    const card = await prisma.card.update({
      where: { id: ownedCard.card.id },
      data: {
        columnId: ownedTarget.column.id,
        order,
      },
    });

    revalidatePath(projectPath(ownedTarget.project.id));

    return { data: card };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}

/**
 * Rewrites every card in the column to clean integer orders (1, 2, 3, ...) with
 * `cardId` inserted between the given neighbors.
 */
async function renumberColumnInserting({
  columnId,
  cardId,
  beforeCardId,
  afterCardId,
}: {
  columnId: string;
  cardId: string;
  beforeCardId: string | null;
  afterCardId: string | null;
}) {
  const siblings = await prisma.card.findMany({
    where: { columnId },
    orderBy: { order: 'asc' },
  });

  const without = siblings.filter((card) => card.id !== cardId);
  let insertIndex = without.length;
  if (beforeCardId) {
    const beforeIndex = without.findIndex((card) => card.id === beforeCardId);
    if (beforeIndex >= 0) insertIndex = beforeIndex + 1;
  } else if (afterCardId) {
    const afterIndex = without.findIndex((card) => card.id === afterCardId);
    if (afterIndex >= 0) insertIndex = afterIndex;
  }

  const orderedIds = without.map((card) => card.id);
  orderedIds.splice(insertIndex, 0, cardId);

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.card.update({
        where: { id },
        data: {
          order: index + 1,
          ...(id === cardId ? { columnId } : {}),
        },
      }),
    ),
  );

  const card = await prisma.card.findFirst({ where: { id: cardId } });
  if (!card) {
    throw new Error('card missing after renumber');
  }
  return card;
}
