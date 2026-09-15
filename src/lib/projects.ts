import { canAdministerProject, type MembershipRole } from '@/lib/boardAccess';
import type { BoardVisibility } from '@/lib/boardView';
import type { LabelView } from '@/lib/labels';
import { accessibleByUser, archivedAccessibleByUser, type BoardAccess } from '@/lib/membership';
import { listOrSeedProjectLabels } from '@/lib/projectLabels';
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
import { getUserPreferences } from '@/lib/userPreferences';

export type SlimBoardCard = {
  id: string;
  title: string;
  code: string;
  dueDate: Date | null;
  dueTimeZone: string | null;
  labelId: string | null;
  assignees: Array<{ id: string; name: string; username: string }>;
  subtaskDone: number;
  subtaskTotal: number;
  commentCount: number;
};

export type BoardPageMember = {
  id: string;
  name: string;
  username: string;
};

export type BoardPage = {
  id: string;
  title: string;
  ownerId: string;
  publicLinkEnabled: boolean;
  columns: Array<{
    id: string;
    title: string;
    order: number;
    cards: SlimBoardCard[];
  }>;
  members: BoardPageMember[];
  viewer: { role: MembershipRole; access: BoardAccess } | null;
  labels: LabelView[];
  boardVisibility: BoardVisibility;
};

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

function parseRole(value: unknown): MembershipRole {
  if (value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER') return value;
  return 'MEMBER';
}

function parseAccess(value: unknown): BoardAccess {
  if (value === 'EDIT' || value === 'COMMENT' || value === 'VIEW') return value;
  return 'EDIT';
}

type LiveBoardCardRows = {
  cards: Array<{
    id: string;
    title: string;
    code: string;
    dueDate: Date | null;
    dueTimeZone: string | null;
    labelId: string | null;
    columnId: string;
  }>;
  assignmentRows: Array<{ cardId: string; userId: string }>;
  subtaskCounts: Array<{ cardId: string; done: boolean; _count: { _all: number } }>;
  commentCounts: Array<{ cardId: string; _count: { _all: number } }>;
};

const LIVE_BOARD_CARD_SELECT = {
  id: true,
  title: true,
  code: true,
  dueDate: true,
  dueTimeZone: true,
  labelId: true,
  columnId: true,
  order: true,
} as const;

async function loadLiveBoardCardRows(columns: Array<{ id: string }>): Promise<LiveBoardCardRows> {
  if (columns.length === 0) {
    return { cards: [], assignmentRows: [], subtaskCounts: [], commentCounts: [] };
  }

  const cards = await prisma.card.findMany({
    where: { columnId: { in: columns.map((column) => column.id) }, archivedAt: null },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: LIVE_BOARD_CARD_SELECT,
  });
  const cardIds = cards.map((card) => card.id);
  const [assignmentRows, subtaskCounts, commentCounts] = await Promise.all([
    cardIds.length === 0
      ? Promise.resolve([])
      : prisma.cardAssignee.findMany({
          where: { cardId: { in: cardIds } },
        }),
    cardIds.length === 0
      ? Promise.resolve([])
      : prisma.subtask.groupBy({
          by: ['cardId', 'done'],
          where: { cardId: { in: cardIds } },
          _count: { _all: true },
        }),
    cardIds.length === 0
      ? Promise.resolve([])
      : prisma.comment.groupBy({
          by: ['cardId'],
          where: { cardId: { in: cardIds } },
          _count: { _all: true },
        }),
  ]);

  return { cards, assignmentRows, subtaskCounts, commentCounts };
}

function slimCardsByColumn(
  rows: LiveBoardCardRows,
  usersById: Map<string, { id: string; name: string; username: string }>,
): Map<string, SlimBoardCard[]> {
  const assigneesByCardId = new Map<
    string,
    Array<{ id: string; name: string; username: string }>
  >();
  for (const row of rows.assignmentRows) {
    const current = assigneesByCardId.get(row.cardId) ?? [];
    current.push(asUserRow(usersById.get(row.userId), row.userId));
    assigneesByCardId.set(row.cardId, current);
  }

  const subtaskProgressByCardId = new Map<string, { done: number; total: number }>();
  for (const row of rows.subtaskCounts) {
    const current = subtaskProgressByCardId.get(row.cardId) ?? { done: 0, total: 0 };
    current.total += row._count._all;
    if (row.done) current.done += row._count._all;
    subtaskProgressByCardId.set(row.cardId, current);
  }

  const commentCountByCardId = new Map<string, number>();
  for (const row of rows.commentCounts) {
    commentCountByCardId.set(row.cardId, row._count._all);
  }

  const cardsByColumnId = new Map<string, SlimBoardCard[]>();
  for (const card of rows.cards) {
    const slim: SlimBoardCard = {
      id: card.id,
      title: card.title,
      code: card.code,
      dueDate: card.dueDate,
      dueTimeZone: card.dueTimeZone ?? null,
      labelId: card.labelId ?? null,
      assignees: assigneesByCardId.get(card.id) ?? [],
      subtaskDone: subtaskProgressByCardId.get(card.id)?.done ?? 0,
      subtaskTotal: subtaskProgressByCardId.get(card.id)?.total ?? 0,
      commentCount: commentCountByCardId.get(card.id) ?? 0,
    };
    const current = cardsByColumnId.get(card.columnId) ?? [];
    current.push(slim);
    cardsByColumnId.set(card.columnId, current);
  }
  return cardsByColumnId;
}

/** Projects the user is a member of, newest first. */
export function listProjectsForUser(userId: string) {
  return prisma.project.findMany({
    where: accessibleByUser(userId),
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * A single project the user is a member of, with its columns and live cards
 * in order. First-paint cards select only face fields and carry comment
 * counts plus aggregated subtask progress, not bodies. Returns null when the project does not exist or the user has no
 * membership.
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

  const rows = await loadLiveBoardCardRows(columns);
  const assigneeUserIds = [...new Set(rows.assignmentRows.map((row) => row.userId))];
  const assigneeUsers =
    assigneeUserIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: assigneeUserIds } },
        });
  const usersById = new Map(assigneeUsers.map((user) => [user.id, user]));
  const cardsByColumnId = slimCardsByColumn(rows, usersById);

  return {
    ...project,
    columns: columns.map((column) => ({
      ...column,
      cards: cardsByColumnId.get(column.id) ?? [],
    })),
  };
}

export type ProjectMember = {
  membershipId: string;
  userId: string;
  name: string;
  username: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  access: 'EDIT' | 'COMMENT' | 'VIEW';
};

const ROLE_ORDER: Record<ProjectMember['role'], number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

function membersFromRows(
  memberships: Array<{ id: string; userId: string; role: unknown; access: unknown }>,
  usersById: Map<string, { id: string; name: string; username: string }>,
): ProjectMember[] {
  return memberships
    .map((membership) => {
      const user = usersById.get(membership.userId);
      return {
        membershipId: membership.id,
        userId: membership.userId,
        name: user?.name ?? '',
        username: user?.username ?? '',
        role: parseRole(membership.role),
        access: parseAccess(membership.access),
      };
    })
    .sort((left, right) => {
      const byRole = ROLE_ORDER[left.role] - ROLE_ORDER[right.role];
      if (byRole !== 0) return byRole;
      return left.name.localeCompare(right.name);
    });
}

/**
 * Members of a project already proven accessible. Does not re-check
 * membership; callers that have not checked must use listProjectMembersForUser.
 */
export async function listMembersForProject(projectId: string): Promise<ProjectMember[]> {
  const memberships = await prisma.membership.findMany({
    where: { projectId },
  });
  const userIds = memberships.map((membership) => membership.userId);
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
        });
  const usersById = new Map(users.map((user) => [user.id, user]));
  return membersFromRows(memberships, usersById);
}

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

  return listMembersForProject(project.id);
}

/**
 * Live board first paint: one accessibleByUser read, then columns, live cards,
 * labels (seeded if empty), member identities, viewer role/access, and prefs.
 */
export async function getBoardPageForUser(
  projectId: string,
  userId: string,
): Promise<BoardPage | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleByUser(userId) },
  });
  if (!project) return null;

  const [columns, memberships, labels, preferences] = await Promise.all([
    prisma.column.findMany({
      where: { projectId: project.id },
      orderBy: { order: 'asc' },
    }),
    prisma.membership.findMany({
      where: { projectId: project.id },
    }),
    listOrSeedProjectLabels(project.id),
    getUserPreferences(userId),
  ]);

  const memberUserIds = memberships.map((membership) => membership.userId);
  const rows = await loadLiveBoardCardRows(columns);
  const assigneeUserIds = rows.assignmentRows.map((row) => row.userId);
  const userIds = [...new Set([...memberUserIds, ...assigneeUserIds])];
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
        });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const cardsByColumnId = slimCardsByColumn(rows, usersById);
  const memberList = membersFromRows(memberships, usersById);
  const viewerRow = memberList.find((member) => member.userId === userId);

  return {
    id: project.id,
    title: project.title,
    ownerId: project.ownerId,
    publicLinkEnabled: project.publicLinkEnabled === true,
    columns: columns.map((column) => ({
      id: column.id,
      title: column.title,
      order: column.order,
      cards: cardsByColumnId.get(column.id) ?? [],
    })),
    members: memberList.map((member) => ({
      id: member.userId,
      name: member.name,
      username: member.username,
    })),
    viewer: viewerRow ? { role: viewerRow.role, access: viewerRow.access } : null,
    labels: labels ?? [],
    boardVisibility: preferences.boardVisibility,
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
          _max: { updatedAt: true },
        });
  const countByColumnId = new Map<string, number>();
  const maxUpdatedByColumnId = new Map<string, Date>();
  for (const row of aggregates) {
    countByColumnId.set(row.columnId, row._count._all);
    if (row._max.updatedAt instanceof Date) {
      maxUpdatedByColumnId.set(row.columnId, row._max.updatedAt);
    }
  }

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
    const owner = asUserRow(usersById.get(project.ownerId), project.ownerId);
    const columnMaxes = projectColumns.flatMap((column) => {
      const updatedAt = maxUpdatedByColumnId.get(column.id);
      return updatedAt ? [{ updatedAt }] : [];
    });
    const updatedAt = latestActivityAt(project.createdAt, columnMaxes);
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
      canAdminister: canAdministerProject(parseRole(myMembership?.role)),
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

/**
 * An archived project the user is a member of. Null when the project is live,
 * missing, or the user has no membership. Used to send a bookmark to /archived
 * instead of 404.
 */
export async function getArchivedProjectForUser(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, ...archivedAccessibleByUser(userId) },
    select: { id: true },
  });
}
