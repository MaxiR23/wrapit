import { prisma } from '@/lib/prisma';

/** Boards owned by the given user, newest first. */
export function listBoardsForUser(ownerId: string) {
  return prisma.board.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * A single board owned by the given user, with its columns and cards in order.
 * Returns null when the board does not exist or belongs to someone else.
 */
export async function getBoardForUser(boardId: string, ownerId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, ownerId },
  });
  if (!board) return null;

  const columns = await prisma.column.findMany({
    where: { boardId: board.id },
    orderBy: { order: 'asc' },
  });

  const cards =
    columns.length === 0
      ? []
      : await prisma.card.findMany({
          where: { columnId: { in: columns.map((column) => column.id) } },
          orderBy: { order: 'asc' },
        });

  const columnsWithCards = columns.map((column) => ({
    ...column,
    cards: cards.filter((card) => card.columnId === column.id),
  }));

  return { ...board, columns: columnsWithCards };
}
