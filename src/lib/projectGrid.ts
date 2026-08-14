import { initials } from '@/lib/initials';

export type ProjectGridStatus = 'NEW' | 'IN_PROGRESS' | 'PAUSED' | 'DONE';

export type ProjectGridMember = {
  id: string;
  name: string;
  initials: string;
};

export type ProjectSummary = {
  id: string;
  title: string;
  status: ProjectGridStatus;
  statusLabel: string;
  taskCount: number;
  doneCount: number;
  percent: number;
  updatedLabel: string;
  starred: boolean;
  members: ProjectGridMember[];
};

export type ProjectProgress = {
  taskCount: number;
  doneCount: number;
  percent: number;
};

type ProgressColumn = {
  title: string;
  order: number;
  cards: unknown[];
};

const STATUS_LABEL: Record<ProjectGridStatus, string> = {
  NEW: 'New',
  IN_PROGRESS: 'In progress',
  PAUSED: 'Paused',
  DONE: 'Done',
};

const STATUS_BAR_CLASS: Record<ProjectGridStatus, string> = {
  NEW: 'bg-status-new',
  IN_PROGRESS: 'bg-status-in-progress',
  PAUSED: 'bg-status-paused',
  DONE: 'bg-status-done',
};

/** Done cards / total cards. No cards → 0 of 0 / 0%. */
export function projectProgress(columns: ProgressColumn[]): ProjectProgress {
  const taskCount = columns.reduce((count, column) => count + column.cards.length, 0);
  if (taskCount === 0) {
    return { taskCount: 0, doneCount: 0, percent: 0 };
  }

  const doneColumn =
    columns.find((column) => column.title.trim().toLowerCase() === 'done') ??
    [...columns].sort((left, right) => left.order - right.order).at(-1);

  const doneCount = doneColumn?.cards.length ?? 0;
  return {
    taskCount,
    doneCount,
    percent: Math.round((doneCount / taskCount) * 100),
  };
}

export function taskProgressLabel(doneCount: number, taskCount: number): string {
  return `${doneCount} of ${taskCount} tasks`;
}

export function taskCountLabel(taskCount: number): string {
  return taskCount === 1 ? '1 task' : `${taskCount} tasks`;
}

export function projectCountLabel(count: number): string {
  return count === 1 ? '1 project' : `${count} projects`;
}

/** Case-insensitive title includes. Empty / whitespace query returns the same list. */
export function filterProjectsByTitle(projects: ProjectSummary[], query: string): ProjectSummary[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return projects;
  return projects.filter((project) => project.title.toLowerCase().includes(needle));
}

export function projectStatusLabel(status: ProjectGridStatus): string {
  return STATUS_LABEL[status];
}

export function projectStatusBarClass(status: ProjectGridStatus): string {
  return STATUS_BAR_CLASS[status];
}

export function parseProjectStatus(status: unknown): ProjectGridStatus {
  if (status === 'IN_PROGRESS' || status === 'PAUSED' || status === 'DONE') {
    return status;
  }
  return 'NEW';
}

/** Owner first, then other memberships, de-duplicated by user id. */
export function projectMembers(input: {
  owner: { id: string; name: string; username: string };
  memberships: Array<{ user: { id: string; name: string; username: string } }>;
}): ProjectGridMember[] {
  const members: ProjectGridMember[] = [];
  const seen = new Set<string>();

  function push(user: { id: string; name: string; username: string }) {
    if (seen.has(user.id)) return;
    seen.add(user.id);
    members.push({
      id: user.id,
      name: user.name,
      initials: initials(user.name, user.username),
    });
  }

  push(input.owner);
  for (const membership of input.memberships) {
    push(membership.user);
  }

  return members;
}

export function latestActivityAt(projectCreatedAt: Date, cards: Array<{ updatedAt: Date }>): Date {
  if (cards.length === 0) return projectCreatedAt;
  return cards.reduce(
    (latest, card) => (card.updatedAt > latest ? card.updatedAt : latest),
    cards[0]!.updatedAt,
  );
}

export function formatUpdatedAt(date: Date, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.round(diffMs / 1000);
  if (Math.abs(seconds) < 60) return 'Updated just now';

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return `Updated ${formatter.format(-minutes, 'minute')}`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `Updated ${formatter.format(-hours, 'hour')}`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `Updated ${formatter.format(-days, 'day')}`;
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return `Updated ${formatter.format(-months, 'month')}`;
  const years = Math.round(days / 365);
  return `Updated ${formatter.format(-years, 'year')}`;
}
