import { accessibleByUser } from '@/lib/membership';
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

/** Projects the user is a member of, newest first. */
export function listProjectsForUser(userId: string) {
  return prisma.project.findMany({
    where: accessibleByUser(userId),
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * A single project the user is a member of, with its columns and cards in order.
 * Returns null when the project does not exist or the user has no membership.
 */
export async function getProjectForUser(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleByUser(userId) },
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

export type ProjectMember = {
  userId: string;
  name: string;
  username: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

const ROLE_ORDER: Record<ProjectMember['role'], number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

/**
 * Members of a project the user can access. Null when the project is missing
 * or the user has no membership. Does not use ownerId for access or listing.
 */
export async function listProjectMembersForUser(
  projectId: string,
  userId: string,
): Promise<ProjectMember[] | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleByUser(userId) },
  });
  if (!project) return null;

  const memberships = await prisma.membership.findMany({
    where: { projectId: project.id },
  });
  const userIds = memberships.map((membership) => membership.userId);
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
        });
  const usersById = new Map(users.map((user) => [user.id, user]));

  return memberships
    .map((membership) => {
      const user = usersById.get(membership.userId);
      const role: ProjectMember['role'] =
        membership.role === 'OWNER' || membership.role === 'ADMIN' || membership.role === 'MEMBER'
          ? membership.role
          : 'MEMBER';
      return {
        userId: membership.userId,
        name: user?.name ?? '',
        username: user?.username ?? '',
        role,
      };
    })
    .sort((left, right) => {
      const byRole = ROLE_ORDER[left.role] - ROLE_ORDER[right.role];
      if (byRole !== 0) return byRole;
      return left.name.localeCompare(right.name);
    });
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
 * Accessible projects for the grid: progress, members, relative updated time.
 * Newest first. Includes any project the user has a Membership on.
 */
export async function listProjectSummariesForUser(userId: string): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: accessibleByUser(userId),
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

/** Latest accessible projects the user opened, most recent first. Capped at 4 after access. */
export function listRecentProjectsForUser(userId: string) {
  return prisma.recentProject.findMany({
    where: {
      userId,
      project: accessibleByUser(userId),
    },
    orderBy: { openedAt: 'desc' },
    take: 4,
  });
}
