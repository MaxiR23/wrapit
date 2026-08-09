import { prisma } from '@/lib/prisma';

/**
 * A column that sits on a board owned by the given user.
 * Returns null when the column is missing or belongs to someone else.
 */
export async function getColumnForUser(columnId: string, ownerId: string) {
  const column = await prisma.column.findFirst({
    where: { id: columnId },
  });
  if (!column) return null;

  const board = await prisma.board.findFirst({
    where: { id: column.boardId, ownerId },
  });
  if (!board) return null;

  return { column, board };
}

/**
 * A card reached through column and board ownership for the given user.
 * Returns null when any link in the chain is missing or not owned.
 */
export async function getCardForUser(cardId: string, ownerId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId },
  });
  if (!card) return null;

  const owned = await getColumnForUser(card.columnId, ownerId);
  if (!owned) return null;

  return { card, column: owned.column, board: owned.board };
}
