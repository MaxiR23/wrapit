import { commentCount, subtaskProgress } from '@/lib/cardCounters';
import { activityCopy } from '@/lib/activityCopy';
import type { CardLabelView } from '@/lib/labels';
import {
  SWIPE_COMMIT_PX,
  SWIPE_LIMIT_PX,
  SWIPE_OPEN_PX,
  SWIPE_REST_PX,
  SWIPE_REVEAL_PX,
  SWIPE_TAP_PX,
} from '@/lib/swipe';

export const ARCHIVED_PAGE_SIZE = 50;
export const ARCHIVED_LONG_PRESS_MS = 420;
export const ARCHIVED_LONG_PRESS_MOVE_PX = 6;
export const ARCHIVED_SWIPE_TAP_PX = SWIPE_TAP_PX;
export const ARCHIVED_SWIPE_REVEAL_PX = SWIPE_REVEAL_PX;
export const ARCHIVED_SWIPE_LIMIT_PX = SWIPE_LIMIT_PX;
export const ARCHIVED_SWIPE_COMMIT_PX = SWIPE_COMMIT_PX;
export const ARCHIVED_SWIPE_OPEN_PX = SWIPE_OPEN_PX;
export const ARCHIVED_SWIPE_REST_PX = SWIPE_REST_PX;

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
  editedAt: Date | null;
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

export type ArchivedProjectColumn = {
  id: string;
  title: string;
  cardCount: number;
};

export type ArchivedProject = {
  id: string;
  title: string;
  description: string | null;
  status: 'NEW' | 'IN_PROGRESS' | 'PAUSED' | 'DONE';
  statusLabel: string;
  taskCount: number;
  doneCount: number;
  percent: number;
  ownerName: string;
  members: ArchivedPerson[];
  columns: ArchivedProjectColumn[];
  archivedAt: Date;
  archivedBy: ArchivedPerson | null;
  canAdminister: boolean;
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

export function matchesArchivedName(name: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return name.toLowerCase().includes(needle);
}

export function matchesArchivedRange(
  item: { archivedAt: Date },
  range: ArchivedDateRange,
  now = new Date(),
): boolean {
  if (range === 'all') return true;
  const ago = archivedAgeDays(item.archivedAt, now);
  if (range === '7') return ago <= 7;
  if (range === '30') return ago <= 30;
  return ago > 30;
}

export function filterArchivedItems<T extends { id: string; archivedAt: Date }>(
  items: T[],
  input: {
    query: string;
    range: ArchivedDateRange;
    sort: ArchivedSort;
    now?: Date;
    matchesSearch: (item: T, query: string) => boolean;
    nameOf: (item: T) => string;
  },
): T[] {
  const now = input.now ?? new Date();
  const matched = items.filter(
    (item) =>
      input.matchesSearch(item, input.query) && matchesArchivedRange(item, input.range, now),
  );
  return matched.slice().sort((left, right) => {
    if (input.sort === 'name') return input.nameOf(left).localeCompare(input.nameOf(right));
    const byDate = right.archivedAt.getTime() - left.archivedAt.getTime();
    if (byDate !== 0) return byDate;
    return right.id.localeCompare(left.id);
  });
}

export function filterArchivedTasks(
  cards: ArchivedTask[],
  input: { query: string; range: ArchivedDateRange; sort: ArchivedSort; now?: Date },
): ArchivedTask[] {
  return filterArchivedItems(cards, {
    ...input,
    matchesSearch: matchesArchivedSearch,
    nameOf: (card) => card.title,
  });
}

export function filterArchivedProjects(
  projects: ArchivedProject[],
  input: { query: string; range: ArchivedDateRange; sort: ArchivedSort; now?: Date },
): ArchivedProject[] {
  return filterArchivedItems(projects, {
    ...input,
    matchesSearch: (project, query) => matchesArchivedName(project.title, query),
    nameOf: (project) => project.title,
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

export function archivedProjectCountLabel(count: number): string {
  return count === 1 ? '1 archived project' : `${count} archived projects`;
}

export function archivedSelectedLabel(count: number): string {
  return count === 1 ? '1 task selected' : `${count} tasks selected`;
}

export function archivedProjectSelectedLabel(count: number): string {
  return count === 1 ? '1 project selected' : `${count} projects selected`;
}

export function archivedPhoneSelectedLabel(count: number): string {
  return count === 1 ? '1 selected' : `${count} selected`;
}

export function formatArchivedDate(date: Date, locale = activityCopy.locale): string {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function archivedByLine(item: { archivedBy: ArchivedPerson | null }): string | null {
  const name = item.archivedBy?.name.trim();
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

export function archivedProjectDetailLine(project: ArchivedProject): string {
  const tasks = project.taskCount === 1 ? '1 task' : `${project.taskCount} tasks`;
  const owner = project.ownerName.trim();
  return owner ? `${tasks} · ${owner}` : tasks;
}

export function archivedEmptyCopy(projectTitle: string): { title: string; body: string } {
  return {
    title: `No archived tasks in ${projectTitle}`,
    body: 'Archive a card from the board and you will find it here.',
  };
}

export const ARCHIVED_PROJECTS_EMPTY = {
  title: 'No archived projects',
  body: 'When you archive a project from its board it will show up here, with its history intact.',
} as const;

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
      editedAt: comment.editedAt ? new Date(comment.editedAt) : null,
    })),
  };
}

export function reviveArchivedProject(project: ArchivedProject): ArchivedProject {
  return {
    ...project,
    archivedAt: new Date(project.archivedAt),
  };
}
