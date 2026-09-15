import { canAdministerProject, type MembershipRole } from '@/lib/boardAccess';
import {
  ARCHIVED_PAGE_SIZE,
  archivedListOrderBy,
  archivedProjectSearchWhere,
  archivedRangeWhere,
  withArchivedListCursor,
  type ArchivedDateRange,
  type ArchivedListCursor,
  type ArchivedPerson,
  type ArchivedProject,
  type ArchivedSort,
} from '@/lib/archived';
import { archivedAccessibleByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import {
  parseProjectStatus,
  projectMembers,
  projectProgress,
  projectStatusLabel,
} from '@/lib/projectGrid';

function asPerson(
  user: { id: string; name?: string; username?: string } | undefined,
  id: string,
): ArchivedPerson {
  return {
    id,
    name: user?.name ?? '',
    username: user?.username ?? '',
  };
}

function parseRole(value: unknown): MembershipRole {
  if (value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER') return value;
  return 'MEMBER';
}

export type ArchivedProjectsQuery = {
  query?: string;
  range?: ArchivedDateRange;
  sort?: ArchivedSort;
  cursor?: ArchivedListCursor;
  take?: number;
  now?: Date;
};

export type ArchivedProjectsPage = {
  projects: ArchivedProject[];
  totalCount: number;
};

/**
 * Archived projects the user is a member of, with progress and team avatars.
 * Search, range, and sort run in SQL. Description is omitted until detail.
 */
export async function listArchivedProjectsForUser(
  userId: string,
  query: ArchivedProjectsQuery = {},
): Promise<ArchivedProjectsPage> {
  const now = query.now ?? new Date();
  const range = query.range ?? 'all';
  const sort = query.sort ?? 'date';
  const take = query.take ?? ARCHIVED_PAGE_SIZE;
  const rangeWhere = archivedRangeWhere(range, now);
  const projectWhere = {
    ...archivedAccessibleByUser(userId),
    archivedAt: { not: null, ...rangeWhere.archivedAt },
    ...archivedProjectSearchWhere(query.query ?? ''),
  };

  const [totalCount, projects] = await Promise.all([
    prisma.project.count({ where: projectWhere }),
    prisma.project.findMany({
      where: withArchivedListCursor(projectWhere, sort, query.cursor),
      orderBy: archivedListOrderBy(sort),
      take,
    }),
  ]);
  if (projects.length === 0) return { projects: [], totalCount };

  const projectIds = projects.map((project) => project.id);
  const [columns, memberships] = await Promise.all([
    prisma.column.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { order: 'asc' },
    }),
    prisma.membership.findMany({
      where: { projectId: { in: projectIds } },
    }),
  ]);
  const columnIds = columns.map((column) => column.id);
  const aggregates =
    columnIds.length === 0
      ? []
      : await prisma.card.groupBy({
          by: ['columnId'],
          where: { columnId: { in: columnIds }, archivedAt: null },
          _count: { _all: true },
        });
  const countByColumnId = new Map(aggregates.map((row) => [row.columnId, row._count._all]));

  const userIds = [
    ...new Set([
      ...projects.map((project) => project.ownerId),
      ...projects.flatMap((project) => (project.archivedById ? [project.archivedById] : [])),
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

  const list = projects.flatMap((project) => {
    if (project.archivedAt == null) return [];
    const projectColumns = columns
      .filter((column) => column.projectId === project.id)
      .map((column) => ({
        id: column.id,
        title: column.title,
        order: column.order,
        cardCount: countByColumnId.get(column.id) ?? 0,
      }));
    const progress = projectProgress(projectColumns);
    const status = parseProjectStatus(project.status);
    const projectMemberships = memberships.filter(
      (membership) => membership.projectId === project.id,
    );
    const owner = asPerson(usersById.get(project.ownerId), project.ownerId);
    const ownerMembership = projectMemberships.find((membership) => membership.role === 'OWNER');
    const ownerName = ownerMembership
      ? asPerson(usersById.get(ownerMembership.userId), ownerMembership.userId).name
      : owner.name;
    const myMembership = projectMemberships.find((membership) => membership.userId === userId);
    const members = projectMembers({
      owner,
      memberships: projectMemberships.map((membership) => ({
        user: asPerson(usersById.get(membership.userId), membership.userId),
      })),
    });

    return [
      {
        id: project.id,
        title: project.title,
        status,
        statusLabel: projectStatusLabel(status),
        taskCount: progress.taskCount,
        doneCount: progress.doneCount,
        percent: progress.percent,
        ownerName,
        members: members.map((member) => ({
          id: member.id,
          name: member.name,
          username: member.username,
        })),
        columns: projectColumns.map((column) => ({
          id: column.id,
          title: column.title,
          cardCount: column.cardCount,
        })),
        archivedAt: project.archivedAt,
        archivedBy: project.archivedById
          ? asPerson(usersById.get(project.archivedById), project.archivedById)
          : null,
        canAdminister: canAdministerProject(parseRole(myMembership?.role)),
        detailLoaded: false,
      },
    ];
  });

  return { projects: list, totalCount };
}

/** Description for an archived project the user can still access. */
export async function getArchivedProjectDetailForUser(
  projectId: string,
  userId: string,
): Promise<{ description: string | null } | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...archivedAccessibleByUser(userId) },
    select: { description: true },
  });
  if (!project) return null;
  return { description: project.description ?? null };
}
