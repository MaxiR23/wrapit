import { canAdministerProject, type MembershipRole } from '@/lib/boardAccess';
import {
  ARCHIVED_PAGE_SIZE,
  archivedCardSearchWhere,
  archivedListOrderBy,
  archivedRangeWhere,
  withArchivedListCursor,
  type ArchivedComment,
  type ArchivedDateRange,
  type ArchivedListCursor,
  type ArchivedPerson,
  type ArchivedProjectPayload,
  type ArchivedSort,
  type ArchivedTask,
} from '@/lib/archived';
import { getCardDetailForUser, loadCardDetailsByIds, type CardDetail } from '@/lib/cardDetail';
import { cardLabelFromRow } from '@/lib/labels';
import { accessibleByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';

function asPerson(
  user: { id: string; name?: string; username?: string } | undefined,
): ArchivedPerson | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name ?? '',
    username: user.username ?? '',
  };
}

function parseRole(value: unknown): MembershipRole {
  if (value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER') return value;
  return 'MEMBER';
}

export type ArchivedCardsQuery = {
  query?: string;
  range?: ArchivedDateRange;
  sort?: ArchivedSort;
  cursor?: ArchivedListCursor;
  take?: number;
  now?: Date;
};

export type ArchivedCardsPage = ArchivedProjectPayload & {
  totalCount: number;
  canAdminister: boolean;
};

const ARCHIVED_LIST_CARD_SELECT = {
  id: true,
  title: true,
  code: true,
  labelId: true,
  columnId: true,
  archivedAt: true,
  archivedById: true,
} as const;

/**
 * Archived cards on a project the user is a member of. Access is
 * accessibleByUser (live project, archived cards). List rows carry progress
 * and comment counts, not bodies. Search, range, and sort run in SQL.
 * canAdminister is the viewer's OWNER/ADMIN membership on that project.
 */
export async function getArchivedCardsForUser(
  projectId: string,
  userId: string,
  query: ArchivedCardsQuery = {},
): Promise<ArchivedCardsPage | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleByUser(userId) },
  });
  if (!project) return null;

  const [columns, membership] = await Promise.all([
    prisma.column.findMany({
      where: { projectId: project.id },
      select: { id: true, title: true },
    }),
    prisma.membership.findFirst({
      where: { userId, projectId: project.id },
      select: { role: true },
    }),
  ]);
  const canAdminister = canAdministerProject(parseRole(membership?.role));
  const columnIds = columns.map((column) => column.id);
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const now = query.now ?? new Date();
  const range = query.range ?? 'all';
  const sort = query.sort ?? 'date';
  const take = query.take ?? ARCHIVED_PAGE_SIZE;
  const search = query.query ?? '';
  const rangeWhere = archivedRangeWhere(range, now);
  const searchWhere = archivedCardSearchWhere(search);

  const cardWhere = {
    columnId: { in: columnIds },
    archivedAt: { not: null, ...rangeWhere.archivedAt },
    ...searchWhere,
  };

  if (columnIds.length === 0) {
    return { id: project.id, title: project.title, cards: [], totalCount: 0, canAdminister };
  }

  const [totalCount, cards] = await Promise.all([
    prisma.card.count({ where: cardWhere }),
    prisma.card.findMany({
      where: withArchivedListCursor(cardWhere, sort, query.cursor),
      orderBy: archivedListOrderBy(sort),
      take,
      select: ARCHIVED_LIST_CARD_SELECT,
    }),
  ]);
  const cardIds = cards.map((card) => card.id);

  const labelIds = [
    ...new Set(cards.map((card) => card.labelId).filter((id): id is string => id != null)),
  ];

  const [labels, assignmentRows, subtaskCounts, commentCounts] = await Promise.all([
    labelIds.length === 0
      ? Promise.resolve([])
      : prisma.label.findMany({
          where: { id: { in: labelIds } },
        }),
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
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const commentCountByCardId = new Map(commentCounts.map((row) => [row.cardId, row._count._all]));

  const userIds = new Set<string>();
  for (const row of assignmentRows) userIds.add(row.userId);
  for (const card of cards) {
    if (card.archivedById) userIds.add(card.archivedById);
  }

  const users =
    userIds.size === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: [...userIds] } },
        });
  const usersById = new Map(users.map((user) => [user.id, user]));

  const assigneesByCardId = new Map<string, ArchivedPerson[]>();
  for (const row of assignmentRows) {
    const person = asPerson(usersById.get(row.userId));
    if (!person) continue;
    const current = assigneesByCardId.get(row.cardId) ?? [];
    current.push(person);
    assigneesByCardId.set(row.cardId, current);
  }

  const subtaskProgressByCardId = new Map<string, { done: number; total: number }>();
  for (const row of subtaskCounts) {
    const current = subtaskProgressByCardId.get(row.cardId) ?? { done: 0, total: 0 };
    current.total += row._count._all;
    if (row.done) current.done += row._count._all;
    subtaskProgressByCardId.set(row.cardId, current);
  }

  const listCards: ArchivedTask[] = cards.flatMap((card) => {
    if (card.archivedAt == null) return [];
    const column = columnsById.get(card.columnId);
    if (!column) return [];
    const labelRow = card.labelId ? labelsById.get(card.labelId) : undefined;
    const progress = subtaskProgressByCardId.get(card.id) ?? { done: 0, total: 0 };
    return [
      {
        id: card.id,
        title: card.title,
        code: card.code,
        description: null,
        archivedAt: card.archivedAt,
        archivedBy: card.archivedById ? asPerson(usersById.get(card.archivedById)) : null,
        column: { id: column.id, title: column.title },
        label: cardLabelFromRow(labelRow),
        assignees: assigneesByCardId.get(card.id) ?? [],
        commentCount: commentCountByCardId.get(card.id) ?? 0,
        subtaskDone: progress.done,
        subtaskTotal: progress.total,
        comments: [] as ArchivedComment[],
        detailLoaded: false,
      },
    ];
  });

  return {
    id: project.id,
    title: project.title,
    cards: listCards,
    totalCount,
    canAdminister,
  };
}

/**
 * Description, subtask text, and comment bodies for one archived card.
 * Access is getCardForUser VIEW, then the card must be archived.
 */
export async function getArchivedCardDetailForUser(
  cardId: string,
  userId: string,
): Promise<(CardDetail & { commentCount: number }) | null> {
  const owned = await prisma.card.findFirst({
    where: { id: cardId, archivedAt: { not: null } },
  });
  if (!owned) return null;

  const detail = await getCardDetailForUser(cardId, userId);
  if (!detail) return null;

  return {
    description: detail.description,
    subtasks: detail.subtasks,
    comments: detail.comments,
    commentCount: detail.comments.length,
  };
}

/**
 * Description, subtask text, and comment bodies for selected archived cards
 * on one project. Access is accessibleByUser, then every id must be an
 * archived card on that project. Null when the membership is missing or any
 * id is not an archived card on the project.
 */
export async function getArchivedCardsDetailForUser(
  projectId: string,
  cardIds: string[],
  userId: string,
): Promise<Record<string, CardDetail & { commentCount: number }> | null> {
  const uniqueIds = [...new Set(cardIds)];
  if (uniqueIds.length === 0) return {};

  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleByUser(userId) },
  });
  if (!project) return null;

  const owned = await prisma.card.findMany({
    where: {
      id: { in: uniqueIds },
      archivedAt: { not: null },
      column: { projectId: project.id },
    },
    select: { id: true },
  });
  if (owned.length !== uniqueIds.length) return null;

  const details = await loadCardDetailsByIds(uniqueIds);
  const result: Record<string, CardDetail & { commentCount: number }> = {};
  for (const id of uniqueIds) {
    const detail = details.get(id);
    if (!detail) return null;
    result[id] = { ...detail, commentCount: detail.comments.length };
  }
  return result;
}
