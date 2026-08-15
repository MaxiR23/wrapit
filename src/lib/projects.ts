import {
  formatUpdatedAt,
  latestActivityAt,
  parseProjectStatus,
  projectMembers,
  projectProgress,
  projectStatusLabel,
  type ProjectSummary,
} from '@/lib/projectGrid';
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

type UserRow = { id: string; name: string; username: string };

function asUserRow(
  row: { id: string; name: string; username: string } | undefined,
  id: string,
): UserRow {
  return {
    id,
    name: row?.name ?? '',
    username: row?.username ?? '',
  };
}

/**
 * Owned projects for the grid: progress, members, relative updated time.
 * Newest first. Does not include projects the user only belongs to as a member.
 */
export async function listProjectSummariesForUser(userId: string): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
  });
  if (projects.length === 0) return [];

  const projectIds = projects.map((project) => project.id);
  const columns = await prisma.column.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { order: 'asc' },
  });
  const columnIds = columns.map((column) => column.id);
  const cards =
    columnIds.length === 0
      ? []
      : await prisma.card.findMany({
          where: { columnId: { in: columnIds } },
        });
  const memberships = await prisma.membership.findMany({
    where: { projectId: { in: projectIds } },
  });

  const userIds = [
    ...new Set([
      ...projects.map((project) => project.ownerId),
      ...memberships.map((membership) => membership.userId),
    ]),
  ];
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
        });
  const usersById = new Map(users.map((user) => [user.id, user]));

  return projects.map((project) => {
    const projectColumns = columns
      .filter((column) => column.projectId === project.id)
      .map((column) => ({
        ...column,
        cards: cards.filter((card) => card.columnId === column.id),
      }));
    const progress = projectProgress(projectColumns);
    const status = parseProjectStatus(project.status);
    const projectMemberships = memberships.filter(
      (membership) => membership.projectId === project.id,
    );
    const owner = asUserRow(usersById.get(project.ownerId), project.ownerId);
    const updatedAt = latestActivityAt(
      project.createdAt,
      projectColumns.flatMap((column) => column.cards),
    );
    const myMembership = projectMemberships.find((membership) => membership.userId === userId);

    return {
      id: project.id,
      title: project.title,
      status,
      statusLabel: projectStatusLabel(status),
      taskCount: progress.taskCount,
      doneCount: progress.doneCount,
      percent: progress.percent,
      updatedLabel: formatUpdatedAt(updatedAt),
      starred: Boolean(myMembership?.starred),
      members: projectMembers({
        owner,
        memberships: projectMemberships.map((membership) => ({
          user: asUserRow(usersById.get(membership.userId), membership.userId),
        })),
      }),
    };
  });
}

/** Latest owned projects the user opened, most recent first. Capped at 4 after access. */
export function listRecentProjectsForUser(userId: string) {
  return prisma.recentProject.findMany({
    where: {
      userId,
      project: { ownerId: userId },
    },
    orderBy: { openedAt: 'desc' },
    take: 4,
  });
}
