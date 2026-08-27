import { commentCount, subtaskProgress } from '@/lib/cardCounters';
import { activityCopy } from '@/lib/activityCopy';
import type { CardLabelView } from '@/lib/labels';

export const ARCHIVED_PAGE_SIZE = 50;
export const ARCHIVED_LONG_PRESS_MS = 420;
export const ARCHIVED_LONG_PRESS_MOVE_PX = 6;
export const ARCHIVED_SWIPE_TAP_PX = 4;
export const ARCHIVED_SWIPE_REVEAL_PX = 8;
export const ARCHIVED_SWIPE_LIMIT_PX = 150;
export const ARCHIVED_SWIPE_COMMIT_PX = 96;
export const ARCHIVED_SWIPE_OPEN_PX = 40;
export const ARCHIVED_SWIPE_REST_PX = 104;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ArchivedDateRange = 'all' | '7' | '30' | 'old';

export type ArchivedSort = 'date' | 'name';

export type ArchivedPerson = {
  id: string;
  name: string;
  username: string;
};

export type ArchivedSubtask = {
  id: string;
  text: string;
  done: boolean;
  order: number;
};

export type ArchivedComment = {
  id: string;
  body: string;
  createdAt: Date;
  author: ArchivedPerson;
};

export type ArchivedTask = {
  id: string;
  title: string;
  code: string;
  description: string | null;
  archivedAt: Date;
  archivedBy: ArchivedPerson | null;
  column: { id: string; title: string };
  label: CardLabelView | null;
  assignees: ArchivedPerson[];
  subtasks: ArchivedSubtask[];
  comments: ArchivedComment[];
};

export type ArchivedProjectPayload = {
  id: string;
  title: string;
  cards: ArchivedTask[];
};

export function archivedAgeDays(archivedAt: Date, now = new Date()): number {
  return Math.floor((now.getTime() - archivedAt.getTime()) / DAY_MS);
}

export function matchesArchivedSearch(card: ArchivedTask, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (card.title.toLowerCase().includes(needle)) return true;
  return (card.label?.name ?? '').toLowerCase().includes(needle);
}

export function matchesArchivedRange(
  card: ArchivedTask,
  range: ArchivedDateRange,
  now = new Date(),
): boolean {
  if (range === 'all') return true;
  const ago = archivedAgeDays(card.archivedAt, now);
  if (range === '7') return ago <= 7;
  if (range === '30') return ago <= 30;
  return ago > 30;
}

export function filterArchivedTasks(
  cards: ArchivedTask[],
  input: { query: string; range: ArchivedDateRange; sort: ArchivedSort; now?: Date },
): ArchivedTask[] {
  const now = input.now ?? new Date();
  const matched = cards.filter(
    (card) =>
      matchesArchivedSearch(card, input.query) && matchesArchivedRange(card, input.range, now),
  );
  return matched.slice().sort((left, right) => {
    if (input.sort === 'name') return left.title.localeCompare(right.title);
    const byDate = right.archivedAt.getTime() - left.archivedAt.getTime();
    if (byDate !== 0) return byDate;
    return right.id.localeCompare(left.id);
  });
}

export function sliceArchivedTasks<T>(
  items: T[],
  limit: number,
): { shown: T[]; remaining: number } {
  const shown = items.slice(0, limit);
  return { shown, remaining: Math.max(0, items.length - shown.length) };
}

export function archivedCountLabel(count: number): string {
  return count === 1 ? '1 archived task' : `${count} archived tasks`;
}

export function archivedSelectedLabel(count: number): string {
  return count === 1 ? '1 task selected' : `${count} tasks selected`;
}

export function archivedPhoneSelectedLabel(count: number): string {
  return count === 1 ? '1 selected' : `${count} selected`;
}

export function formatArchivedDate(date: Date, locale = activityCopy.locale): string {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function archivedByLine(card: ArchivedTask): string | null {
  const name = card.archivedBy?.name.trim();
  if (!name) return null;
  return `by ${name}`;
}

export function archivedTaskDetailLine(card: ArchivedTask): string {
  const progress = subtaskProgress(card.subtasks);
  const comments = commentCount(card.comments);
  const subtaskText =
    progress.total === 1 ? '1 subtask' : `${progress.done}/${progress.total} subtasks`;
  const commentText = comments === 1 ? '1 comment' : `${comments} comments`;
  return `${subtaskText} · ${commentText}`;
}

export function archivedEmptyCopy(projectTitle: string): { title: string; body: string } {
  return {
    title: `No archived tasks in ${projectTitle}`,
    body: 'Archive a card from the board and you will find it here.',
  };
}

export const ARCHIVED_FILTER_EMPTY = {
  title: 'No results',
  body: 'No archived item matches the search and date range.',
} as const;

export function reviveArchivedTask(card: ArchivedTask): ArchivedTask {
  return {
    ...card,
    archivedAt: new Date(card.archivedAt),
    comments: card.comments.map((comment) => ({
      ...comment,
      createdAt: new Date(comment.createdAt),
    })),
  };
}
