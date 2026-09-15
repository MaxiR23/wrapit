import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';

export type CardDetailAuthor = {
  id: string;
  name: string;
  username: string;
};

export type CardDetailSubtask = {
  id: string;
  text: string;
  done: boolean;
  order: number;
};

export type CardDetailComment = {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  author: CardDetailAuthor;
};

export type CardDetail = {
  description: string | null;
  subtasks: CardDetailSubtask[];
  comments: CardDetailComment[];
};

function asAuthor(
  row: { id: string; name?: string; username?: string } | undefined,
  id: string,
): CardDetailAuthor {
  return {
    id,
    name: row?.name ?? '',
    username: row?.username ?? '',
  };
}

function sortSubtasks<T extends { id: string; order: number }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.id.localeCompare(right.id);
  });
}

function sortComments<T extends { id: string; createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const byTime = left.createdAt.getTime() - right.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return left.id.localeCompare(right.id);
  });
}

/** Description, subtasks, and comments for known card ids. Caller checks access. */
export async function loadCardDetailsByIds(cardIds: string[]): Promise<Map<string, CardDetail>> {
  const uniqueIds = [...new Set(cardIds)];
  const details = new Map<string, CardDetail>();
  if (uniqueIds.length === 0) return details;

  const [cards, subtaskRows, commentRows] = await Promise.all([
    prisma.card.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, description: true },
    }),
    prisma.subtask.findMany({
      where: { cardId: { in: uniqueIds } },
    }),
    prisma.comment.findMany({
      where: { cardId: { in: uniqueIds } },
    }),
  ]);
  const authorIds = [...new Set(commentRows.map((row) => row.authorId))];
  const authors =
    authorIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: authorIds } },
        });
  const authorsById = new Map(authors.map((user) => [user.id, user]));
  const subtasksByCardId = new Map<string, CardDetailSubtask[]>();
  for (const row of sortSubtasks(subtaskRows)) {
    const current = subtasksByCardId.get(row.cardId) ?? [];
    current.push({ id: row.id, text: row.text, done: row.done, order: row.order });
    subtasksByCardId.set(row.cardId, current);
  }
  const commentsByCardId = new Map<string, CardDetailComment[]>();
  for (const row of sortComments(commentRows)) {
    const current = commentsByCardId.get(row.cardId) ?? [];
    current.push({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      editedAt: row.editedAt ?? null,
      author: asAuthor(authorsById.get(row.authorId), row.authorId),
    });
    commentsByCardId.set(row.cardId, current);
  }

  for (const card of cards) {
    details.set(card.id, {
      description: card.description ?? null,
      subtasks: subtasksByCardId.get(card.id) ?? [],
      comments: commentsByCardId.get(card.id) ?? [],
    });
  }
  return details;
}

/**
 * Description, ordered subtasks with text, and comments with authors.
 * Access is getCardForUser → column → withBoardAccess at VIEW, same chain as
 * writes. Null when the card is missing or the membership is too weak.
 */
export async function getCardDetailForUser(
  cardId: string,
  userId: string,
): Promise<CardDetail | null> {
  const owned = await getCardForUser(cardId, userId, 'VIEW');
  if (!owned) return null;

  const details = await loadCardDetailsByIds([owned.card.id]);
  return details.get(owned.card.id) ?? null;
}
