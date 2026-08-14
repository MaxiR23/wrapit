import { prisma } from '@/lib/prisma';

/** Projects owned by the given user, newest first. */
export function listProjectsForUser(ownerId: string) {
  return prisma.project.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * A single project owned by the given user, with its columns and cards in order.
 * Returns null when the project does not exist or belongs to someone else.
 */
export async function getProjectForUser(projectId: string, ownerId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
  });
  if (!project) return null;

  const columns = await prisma.column.findMany({
    where: { projectId: project.id },
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

  return { ...project, columns: columnsWithCards };
}
