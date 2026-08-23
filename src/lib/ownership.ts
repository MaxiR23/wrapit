import { accessibleByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';

/**
 * A column that sits on a project the given user can access.
 * Returns null when the column is missing or the user has no membership.
 */
export async function getColumnForUser(columnId: string, userId: string) {
  const column = await prisma.column.findFirst({
    where: { id: columnId },
  });
  if (!column) return null;

  const project = await prisma.project.findFirst({
    where: { id: column.projectId, ...accessibleByUser(userId) },
  });
  if (!project) return null;

  return { column, project };
}

/**
 * A card reached through column and project membership for the given user.
 * Returns null when any link in the chain is missing or not accessible.
 */
export async function getCardForUser(cardId: string, userId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId },
  });
  if (!card) return null;

  const owned = await getColumnForUser(card.columnId, userId);
  if (!owned) return null;

  return { card, column: owned.column, project: owned.project };
}

/**
 * A label on a project the given user can access.
 * Returns null when the label is missing or the user has no membership.
 */
export async function getLabelForUser(labelId: string, userId: string) {
  const label = await prisma.label.findFirst({
    where: { id: labelId },
  });
  if (!label) return null;

  const project = await prisma.project.findFirst({
    where: { id: label.projectId, ...accessibleByUser(userId) },
  });
  if (!project) return null;

  return { label, project };
}
