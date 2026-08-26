import { dueDeltaDays, isCardDueLate } from '@/lib/cardDue';
import { cardLabelFromRow, type CardLabelView } from '@/lib/labels';
import type { BoardAccess } from '@/lib/membership';
import { doneColumnFrom, inboxColumnFrom } from '@/lib/projectGrid';

export type MyTaskAssignee = {
  id: string;
  name: string;
  username: string;
};

export type MyTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  dueTimeZone: string | null;
  label: CardLabelView | null;
  subtasks: Array<{ id: string; done: boolean }>;
  assignees: MyTaskAssignee[];
  project: { id: string; title: string; access: BoardAccess };
  columnId: string;
  completed: boolean;
};

export type MyTasksCreateProject = {
  id: string;
  title: string;
  inboxColumnId: string;
};

export type MyTasksList = {
  tasks: MyTask[];
  createProjects: MyTasksCreateProject[];
  openCount: number;
};

export type MyTasksPeriod = 'overdue' | 'today' | 'week' | 'all';

export type MyTaskDueGroup = 'overdue' | 'today' | 'week' | 'later' | 'nodate';

export type MyTasksEmptyKind = 'search' | 'allDone' | 'nothingPending';

export const MY_TASK_GROUP_ORDER: readonly MyTaskDueGroup[] = [
  'overdue',
  'today',
  'week',
  'later',
  'nodate',
];

export const MY_TASK_GROUP_COPY: Record<MyTaskDueGroup, { title: string; note: string | null }> = {
  overdue: { title: 'Overdue', note: 'they have passed their due date' },
  today: { title: 'Today', note: 'due today' },
  week: { title: 'This week', note: null },
  later: { title: 'Later', note: null },
  nodate: { title: 'No date', note: 'still without a due date' },
};

type FindMany = {
  findMany: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string>;
  }) => Promise<Array<Record<string, unknown>>>;
};

export type MyTasksDb = {
  membership: FindMany;
  project: FindMany;
  cardAssignee: FindMany;
  card: FindMany;
  column: FindMany;
  label: FindMany;
  user: FindMany;
  subtask: FindMany;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  return null;
}

function parseAccess(value: unknown): BoardAccess {
  if (value === 'EDIT' || value === 'COMMENT' || value === 'VIEW') return value;
  return 'VIEW';
}

function dueOf(task: Pick<MyTask, 'dueDate' | 'dueTimeZone'>): {
  dueDate: Date;
  dueTimeZone: string | null;
} | null {
  if (task.dueDate == null) return null;
  return { dueDate: task.dueDate, dueTimeZone: task.dueTimeZone };
}

/** Monday-start weekday of `now` in the viewer's local calendar: Mon=0 … Sun=6. */
function mondayIndex(now: Date): number {
  return (now.getDay() + 6) % 7;
}

function daysUntilSunday(now: Date): number {
  return 6 - mondayIndex(now);
}

export function taskDueGroup(
  task: Pick<MyTask, 'dueDate' | 'dueTimeZone'>,
  now: Date,
  viewerTimeZone?: string | null,
): MyTaskDueGroup {
  const due = dueOf(task);
  if (due == null) return 'nodate';
  if (isCardDueLate(due, now)) return 'overdue';
  const delta = dueDeltaDays(due, { now, viewerTimeZone });
  if (delta === 0) return 'today';
  if (delta > 0 && delta <= daysUntilSunday(now)) return 'week';
  return 'later';
}

export function matchesMyTaskSearch(task: MyTask, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  if (task.title.toLowerCase().includes(needle)) return true;
  if (task.project.title.toLowerCase().includes(needle)) return true;
  return (task.label?.name ?? '').toLowerCase().includes(needle);
}

export function matchesMyTaskProject(task: MyTask, projectId: string | null): boolean {
  if (projectId == null || projectId === '') return true;
  return task.project.id === projectId;
}

export function matchesMyTaskPeriod(
  task: MyTask,
  period: MyTasksPeriod,
  now: Date,
  viewerTimeZone?: string | null,
): boolean {
  const group = taskDueGroup(task, now, viewerTimeZone);
  if (period === 'overdue') return group === 'overdue';
  if (group === 'overdue') return true;
  if (period === 'all') return true;
  if (period === 'today') return group === 'today';
  return group === 'today' || group === 'week';
}

export function filterOpenMyTasks({
  tasks,
  query,
  projectId,
  period,
  now,
  viewerTimeZone,
}: {
  tasks: MyTask[];
  query: string;
  projectId: string | null;
  period: MyTasksPeriod;
  now: Date;
  viewerTimeZone?: string | null;
}): MyTask[] {
  return tasks.filter((task) => {
    if (task.completed) return false;
    if (!matchesMyTaskSearch(task, query)) return false;
    if (!matchesMyTaskProject(task, projectId)) return false;
    return matchesMyTaskPeriod(task, period, now, viewerTimeZone);
  });
}

export function filterCompletedMyTasks({
  tasks,
  query,
  projectId,
}: {
  tasks: MyTask[];
  query: string;
  projectId: string | null;
}): MyTask[] {
  return tasks.filter((task) => {
    if (!task.completed) return false;
    if (!matchesMyTaskSearch(task, query)) return false;
    return matchesMyTaskProject(task, projectId);
  });
}

export type MyTaskGroupView = {
  key: MyTaskDueGroup;
  title: string;
  note: string | null;
  showHeader: boolean;
  tasks: MyTask[];
};

export function groupMyTasks(
  tasks: MyTask[],
  now: Date,
  viewerTimeZone: string | null | undefined,
  period: MyTasksPeriod,
): MyTaskGroupView[] {
  const buckets = new Map<MyTaskDueGroup, MyTask[]>();
  for (const task of tasks) {
    const key = taskDueGroup(task, now, viewerTimeZone);
    const current = buckets.get(key) ?? [];
    current.push(task);
    buckets.set(key, current);
  }
  return MY_TASK_GROUP_ORDER.flatMap((key) => {
    const grouped = buckets.get(key);
    if (grouped == null || grouped.length === 0) return [];
    const copy = MY_TASK_GROUP_COPY[key];
    return [
      {
        key,
        title: copy.title,
        note: copy.note,
        showHeader: !(key === 'overdue' && period === 'overdue'),
        tasks: grouped,
      },
    ];
  });
}

export function myTaskProjectChips(tasks: MyTask[]): Array<{ id: string; title: string }> {
  const chips: Array<{ id: string; title: string }> = [];
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.project.id)) continue;
    seen.add(task.project.id);
    chips.push({ id: task.project.id, title: task.project.title });
  }
  return chips;
}

export function myTasksHasLate(
  tasks: MyTask[],
  query: string,
  projectId: string | null,
  now: Date,
  viewerTimeZone?: string | null,
): boolean {
  return tasks.some((task) => {
    if (task.completed) return false;
    if (!matchesMyTaskSearch(task, query)) return false;
    if (!matchesMyTaskProject(task, projectId)) return false;
    return taskDueGroup(task, now, viewerTimeZone) === 'overdue';
  });
}

export function myTasksSummary(openFiltered: MyTask[], now: Date): string {
  const openCount = openFiltered.length;
  const overdueCount = openFiltered.filter((task) => {
    const due = dueOf(task);
    return due != null && isCardDueLate(due, now);
  }).length;
  const openPart = openCount === 1 ? '1 open task' : `${openCount} open tasks`;
  if (overdueCount === 0) return openPart;
  const overduePart = overdueCount === 1 ? '1 overdue' : `${overdueCount} overdue`;
  return `${openPart} · ${overduePart}`;
}

export function myTasksEmptyKind({
  openGroups,
  query,
  openMatchingSearchAndProject,
  completedMatching,
}: {
  openGroups: number;
  query: string;
  openMatchingSearchAndProject: number;
  completedMatching: number;
}): MyTasksEmptyKind | null {
  if (openGroups > 0) return null;
  if (query.trim() !== '') return 'search';
  if (openMatchingSearchAndProject === 0 && completedMatching > 0) return 'allDone';
  return 'nothingPending';
}

export function myTasksEmptyCopy(
  kind: MyTasksEmptyKind,
  query: string,
): { title: string; note: string } {
  if (kind === 'search') {
    return {
      title: `No results for "${query.trim()}"`,
      note: 'We searched in the title, the project, and the label.',
    };
  }
  if (kind === 'allDone') {
    return {
      title: "You're all done",
      note: 'There are no open tasks left in this period.',
    };
  }
  return {
    title: 'Nothing pending here',
    note: 'Try another period or check your projects.',
  };
}

type AssignedContext = {
  memberships: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  columns: Array<Record<string, unknown>>;
  cards: Array<Record<string, unknown>>;
  completedByCardId: Map<string, boolean>;
  accessByProjectId: Map<string, BoardAccess>;
  projectIdByColumnId: Map<string, string>;
};

const EMPTY_LIST: MyTasksList = { tasks: [], createProjects: [], openCount: 0 };

async function loadAssignedContext(db: MyTasksDb, userId: string): Promise<AssignedContext | null> {
  const memberships = await db.membership.findMany({ where: { userId } });
  if (memberships.length === 0) return null;

  const projectIds = memberships.map((membership) => asString(membership.projectId));
  const memberProjectIds = new Set(projectIds);
  const accessByProjectId = new Map(
    memberships.map((membership) => [
      asString(membership.projectId),
      parseAccess(membership.access),
    ]),
  );

  const assignments = await db.cardAssignee.findMany({ where: { userId } });
  const assignedCardIds = assignments.map((row) => asString(row.cardId));
  const cards =
    assignedCardIds.length === 0
      ? []
      : await db.card.findMany({
          where: { id: { in: assignedCardIds }, archivedAt: null },
        });

  const columns =
    projectIds.length === 0
      ? []
      : await db.column.findMany({
          where: { projectId: { in: projectIds } },
        });
  const projectIdByColumnId = new Map(
    columns.map((column) => [asString(column.id), asString(column.projectId)]),
  );

  const columnsByProjectId = new Map<string, Array<{ id: string; title: string; order: number }>>();
  for (const column of columns) {
    const projectId = asString(column.projectId);
    const current = columnsByProjectId.get(projectId) ?? [];
    current.push({
      id: asString(column.id),
      title: asString(column.title),
      order: typeof column.order === 'number' ? column.order : 0,
    });
    columnsByProjectId.set(projectId, current);
  }
  const doneIdByProjectId = new Map<string, string | null>();
  for (const [projectId, projectColumns] of columnsByProjectId) {
    doneIdByProjectId.set(projectId, doneColumnFrom(projectColumns)?.id ?? null);
  }

  const visibleCards = cards.filter((card) => {
    const projectId = projectIdByColumnId.get(asString(card.columnId));
    return projectId != null && memberProjectIds.has(projectId);
  });
  const completedByCardId = new Map<string, boolean>();
  for (const card of visibleCards) {
    const projectId = projectIdByColumnId.get(asString(card.columnId));
    const doneId = projectId ? (doneIdByProjectId.get(projectId) ?? null) : null;
    completedByCardId.set(asString(card.id), doneId != null && asString(card.columnId) === doneId);
  }

  const projects =
    projectIds.length === 0
      ? []
      : await db.project.findMany({
          where: { id: { in: projectIds } },
          orderBy: { createdAt: 'desc' },
        });

  return {
    memberships,
    projects,
    columns,
    cards: visibleCards,
    completedByCardId,
    accessByProjectId,
    projectIdByColumnId,
  };
}

function createProjectsFrom(
  projects: Array<Record<string, unknown>>,
  columns: Array<Record<string, unknown>>,
  accessByProjectId: Map<string, BoardAccess>,
): MyTasksCreateProject[] {
  const columnsByProjectId = new Map<string, Array<{ id: string; title: string; order: number }>>();
  for (const column of columns) {
    const projectId = asString(column.projectId);
    const current = columnsByProjectId.get(projectId) ?? [];
    current.push({
      id: asString(column.id),
      title: asString(column.title),
      order: typeof column.order === 'number' ? column.order : 0,
    });
    columnsByProjectId.set(projectId, current);
  }

  const createProjects: MyTasksCreateProject[] = [];
  for (const project of projects) {
    const id = asString(project.id);
    if (accessByProjectId.get(id) !== 'EDIT') continue;
    const inbox = inboxColumnFrom(columnsByProjectId.get(id) ?? []);
    if (inbox == null) continue;
    createProjects.push({ id, title: asString(project.title), inboxColumnId: inbox.id });
  }
  return createProjects;
}

/**
 * Assigned, non-archived cards across projects the user currently belongs to.
 * One pass per table, not a query per project.
 */
export async function listMyTasksForUser(db: MyTasksDb, userId: string): Promise<MyTasksList> {
  const context = await loadAssignedContext(db, userId);
  if (!context) return EMPTY_LIST;

  const cardIds = context.cards.map((card) => asString(card.id));
  const labelIds = [
    ...new Set(
      context.cards
        .map((card) => (typeof card.labelId === 'string' ? card.labelId : null))
        .filter((id): id is string => id != null && id.length > 0),
    ),
  ];
  const labels =
    labelIds.length === 0 ? [] : await db.label.findMany({ where: { id: { in: labelIds } } });
  const labelById = new Map(labels.map((label) => [asString(label.id), cardLabelFromRow(label)]));

  const assignmentRows =
    cardIds.length === 0
      ? []
      : await db.cardAssignee.findMany({ where: { cardId: { in: cardIds } } });
  const assigneeUserIds = [...new Set(assignmentRows.map((row) => asString(row.userId)))];
  const users =
    assigneeUserIds.length === 0
      ? []
      : await db.user.findMany({ where: { id: { in: assigneeUserIds } } });
  const userById = new Map(
    users.map((user) => [
      asString(user.id),
      {
        id: asString(user.id),
        name: asString(user.name),
        username: asString(user.username),
      },
    ]),
  );
  const assigneesByCardId = new Map<string, MyTaskAssignee[]>();
  for (const row of assignmentRows) {
    const cardId = asString(row.cardId);
    const userIdValue = asString(row.userId);
    const user = userById.get(userIdValue) ?? { id: userIdValue, name: '', username: '' };
    const current = assigneesByCardId.get(cardId) ?? [];
    current.push(user);
    assigneesByCardId.set(cardId, current);
  }

  const subtaskRows =
    cardIds.length === 0 ? [] : await db.subtask.findMany({ where: { cardId: { in: cardIds } } });
  const subtasksByCardId = new Map<string, Array<{ id: string; done: boolean }>>();
  for (const row of subtaskRows) {
    const cardId = asString(row.cardId);
    const current = subtasksByCardId.get(cardId) ?? [];
    current.push({ id: asString(row.id), done: row.done === true });
    subtasksByCardId.set(cardId, current);
  }

  const projectById = new Map(
    context.projects.map((project) => [asString(project.id), asString(project.title)]),
  );

  const tasks: MyTask[] = context.cards.map((card) => {
    const columnId = asString(card.columnId);
    const projectId = context.projectIdByColumnId.get(columnId) ?? '';
    const labelId = typeof card.labelId === 'string' ? card.labelId : null;
    return {
      id: asString(card.id),
      title: asString(card.title),
      dueDate: asDate(card.dueDate),
      dueTimeZone: typeof card.dueTimeZone === 'string' ? card.dueTimeZone : null,
      label: labelId ? (labelById.get(labelId) ?? null) : null,
      subtasks: subtasksByCardId.get(asString(card.id)) ?? [],
      assignees: assigneesByCardId.get(asString(card.id)) ?? [],
      project: {
        id: projectId,
        title: projectById.get(projectId) ?? '',
        access: context.accessByProjectId.get(projectId) ?? 'VIEW',
      },
      columnId,
      completed: context.completedByCardId.get(asString(card.id)) === true,
    };
  });

  const openCount = tasks.filter((task) => !task.completed).length;
  return {
    tasks,
    createProjects: createProjectsFrom(
      context.projects,
      context.columns,
      context.accessByProjectId,
    ),
    openCount,
  };
}

/** Open assigned cards for the sidebar badge. Same membership and Done rules as the list. */
export async function countOpenMyTasksForUser(db: MyTasksDb, userId: string): Promise<number> {
  const context = await loadAssignedContext(db, userId);
  if (!context) return 0;
  let open = 0;
  for (const card of context.cards) {
    if (context.completedByCardId.get(asString(card.id)) !== true) open += 1;
  }
  return open;
}
