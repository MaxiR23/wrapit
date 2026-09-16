import { canAdministerProject, type MembershipRole } from '@/lib/boardAccess';
import {
  ARCHIVED_PAGE_SIZE,
  archivedProjectSearchWhere,
  archivedRangeWhere,
  type ArchivedDateRange,
  type ArchivedPerson,
  type ArchivedProject,
  type ArchivedSort,
} from '@/lib/archived';
import { archivedAccessibleByUser } from '@/lib/membership';
import { fetchPage, type PaginationOrder } from '@/lib/pagination';
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

function archivedProjectsOrder(sort: ArchivedSort): PaginationOrder {
  if (sort === 'name') {
    return { field: 'title', type: 'string', direction: 'asc', idDirection: 'asc' };
  }
  return { field: 'archivedAt', type: 'date', direction: 'desc', idDirection: 'desc' };
}

export type ArchivedProjectsQuery = {
  query?: string;
  range?: ArchivedDateRange;
  sort?: ArchivedSort;
  cursor?: string;
  take?: number;
  now?: Date;
  excludeIds?: string[];
};

function excludeIdWhere(
  excludeIds: string[] | undefined,
): { id: { notIn: string[] } } | Record<string, never> {
  if (excludeIds == null || excludeIds.length === 0) return {};
  return { id: { notIn: excludeIds } };
}

function archivedProjectListWhere(input: {
  userId: string;
  query: string;
  range: ArchivedDateRange;
  now: Date;
  excludeIds?: string[];
}) {
  const rangeWhere = archivedRangeWhere(input.range, input.now);
  return {
    ...archivedAccessibleByUser(input.userId),
    archivedAt: { not: null, ...rangeWhere.archivedAt },
    ...archivedProjectSearchWhere(input.query),
    ...excludeIdWhere(input.excludeIds),
  };
}

export type ArchivedProjectsPage = {
  projects: ArchivedProject[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
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
  const projectWhere = archivedProjectListWhere({
    userId,
    query: query.query ?? '',
    range,
    now,
    excludeIds: query.excludeIds,
  });

  const { totalCount, page } = await prisma.$transaction(
    async (tx) => {
      const [count, fetched] = await Promise.all([
        tx.project.count({ where: projectWhere }),
        fetchPage({
          pageSize: take,
          order: archivedProjectsOrder(sort),
          cursor: query.cursor,
          where: projectWhere,
          findMany: (args) => tx.project.findMany(args),
        }),
      ]);
      return { totalCount: count, page: fetched };
    },
    { isolationLevel: 'RepeatableRead' },
  );
  const projects = page.items;
  if (projects.length === 0) {
    return { projects: [], totalCount, hasMore: page.hasMore, nextCursor: page.nextCursor };
  }

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

  return { projects: list, totalCount, hasMore: page.hasMore, nextCursor: page.nextCursor };
}

export async function countArchivedProjectsForUser(
  userId: string,
  query: ArchivedProjectsQuery = {},
): Promise<{ totalCount: number }> {
  const totalCount = await prisma.project.count({
    where: archivedProjectListWhere({
      userId,
      query: query.query ?? '',
      range: query.range ?? 'all',
      now: query.now ?? new Date(),
      excludeIds: query.excludeIds,
    }),
  });
  return { totalCount };
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
