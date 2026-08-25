import { withBoardAccess, type BoardAccess } from '@/lib/membership';
import { prisma } from '@/lib/prisma';

/**
 * A column that sits on a project the given user can access at `minAccess`.
 * Returns null when the column is missing or the membership is too weak.
 */
export async function getColumnForUser(
  columnId: string,
  userId: string,
  minAccess: BoardAccess = 'VIEW',
) {
  const column = await prisma.column.findFirst({
    where: { id: columnId },
  });
  if (!column) return null;

  const project = await prisma.project.findFirst({
    where: { id: column.projectId, ...withBoardAccess(userId, minAccess) },
  });
  if (!project) return null;

  return { column, project };
}

/**
 * A card reached through column and project membership for the given user.
 * Returns null when any link in the chain is missing or below `minAccess`.
 */
export async function getCardForUser(
  cardId: string,
  userId: string,
  minAccess: BoardAccess = 'VIEW',
) {
  const card = await prisma.card.findFirst({
    where: { id: cardId },
  });
  if (!card) return null;

  const owned = await getColumnForUser(card.columnId, userId, minAccess);
  if (!owned) return null;

  return { card, column: owned.column, project: owned.project };
}

/**
 * A subtask reached through its card, column, and project membership.
 * Returns null when any link in the chain is missing or below `minAccess`.
 */
export async function getSubtaskForUser(
  subtaskId: string,
  userId: string,
  minAccess: BoardAccess = 'VIEW',
) {
  const subtask = await prisma.subtask.findFirst({
    where: { id: subtaskId },
  });
  if (!subtask) return null;

  const owned = await getCardForUser(subtask.cardId, userId, minAccess);
  if (!owned) return null;

  return { subtask, card: owned.card, column: owned.column, project: owned.project };
}

/**
 * A label on a project the given user can access at `minAccess`.
 * Returns null when the label is missing or the membership is too weak.
 */
export async function getLabelForUser(
  labelId: string,
  userId: string,
  minAccess: BoardAccess = 'VIEW',
) {
  const label = await prisma.label.findFirst({
    where: { id: labelId },
  });
  if (!label) return null;

  const project = await prisma.project.findFirst({
    where: { id: label.projectId, ...withBoardAccess(userId, minAccess) },
  });
  if (!project) return null;

  return { label, project };
}
