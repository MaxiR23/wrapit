import { cardLabelFromRow } from '@/lib/labels';
import { accessibleByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import type {
  ArchivedComment,
  ArchivedPerson,
  ArchivedProjectPayload,
  ArchivedSubtask,
} from '@/lib/archived';

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

/**
 * Archived cards on a project the user is a member of, with label, column,
 * subtasks, comments, assignees, and who archived them. Eight finds, always
 * the same shape. Returns null when the project is missing or inaccessible.
 */
export async function getArchivedCardsForUser(
  projectId: string,
  userId: string,
): Promise<ArchivedProjectPayload | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleByUser(userId) },
  });
  if (!project) return null;

  const columns = await prisma.column.findMany({
    where: { projectId: project.id },
    select: { id: true, title: true },
  });
  const columnIds = columns.map((column) => column.id);
  const columnsById = new Map(columns.map((column) => [column.id, column]));

  const cards =
    columnIds.length === 0
      ? []
      : await prisma.card.findMany({
          where: { columnId: { in: columnIds }, archivedAt: { not: null } },
          orderBy: [{ archivedAt: 'desc' }, { id: 'desc' }],
        });
  const cardIds = cards.map((card) => card.id);

  const labelIds = [
    ...new Set(cards.map((card) => card.labelId).filter((id): id is string => id != null)),
  ];
  const labels =
    labelIds.length === 0
      ? []
      : await prisma.label.findMany({
          where: { id: { in: labelIds } },
        });
  const labelsById = new Map(labels.map((label) => [label.id, label]));

  const assignmentRows =
    cardIds.length === 0
      ? []
      : await prisma.cardAssignee.findMany({
          where: { cardId: { in: cardIds } },
        });

  const subtaskRows =
    cardIds.length === 0
      ? []
      : await prisma.subtask.findMany({
          where: { cardId: { in: cardIds } },
        });

  const commentRows =
    cardIds.length === 0
      ? []
      : await prisma.comment.findMany({
          where: { cardId: { in: cardIds } },
        });

  const userIds = new Set<string>();
  for (const row of assignmentRows) userIds.add(row.userId);
  for (const card of cards) {
    if (card.archivedById) userIds.add(card.archivedById);
  }
  for (const row of commentRows) userIds.add(row.authorId);

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

  const subtasksByCardId = new Map<string, ArchivedSubtask[]>();
  const sortedSubtasks = [...subtaskRows].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.id.localeCompare(right.id);
  });
  for (const row of sortedSubtasks) {
    const current = subtasksByCardId.get(row.cardId) ?? [];
    current.push({ id: row.id, text: row.text, done: row.done, order: row.order });
    subtasksByCardId.set(row.cardId, current);
  }

  const commentsByCardId = new Map<string, ArchivedComment[]>();
  const sortedComments = [...commentRows].sort((left, right) => {
    const byTime = left.createdAt.getTime() - right.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return left.id.localeCompare(right.id);
  });
  for (const row of sortedComments) {
    const author = asPerson(usersById.get(row.authorId)) ?? {
      id: row.authorId,
      name: '',
      username: '',
    };
    const current = commentsByCardId.get(row.cardId) ?? [];
    current.push({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      author,
    });
    commentsByCardId.set(row.cardId, current);
  }

  return {
    id: project.id,
    title: project.title,
    cards: cards.flatMap((card) => {
      if (card.archivedAt == null) return [];
      const column = columnsById.get(card.columnId);
      if (!column) return [];
      const labelRow = card.labelId ? labelsById.get(card.labelId) : undefined;
      return [
        {
          id: card.id,
          title: card.title,
          code: card.code,
          description: card.description ?? null,
          archivedAt: card.archivedAt,
          archivedBy: card.archivedById ? asPerson(usersById.get(card.archivedById)) : null,
          column: { id: column.id, title: column.title },
          label: cardLabelFromRow(labelRow),
          assignees: assigneesByCardId.get(card.id) ?? [],
          subtasks: subtasksByCardId.get(card.id) ?? [],
          comments: commentsByCardId.get(card.id) ?? [],
        },
      ];
    }),
  };
}
