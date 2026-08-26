// tests/lib/myTasks.test.ts
//
// Tests for the My tasks query, due grouping, AND filters, and empty states.
//
// Tested:
// - Lists assigned cards across projects in one assignment pass
// - Marks Done (or last-column) cards as completed
// - Ignores archived cards and assignments on projects the user left
// - Does not include cards assigned only to other people
// - EDIT projects with an inbox column appear in the create list
// - Filters combine search, project, and period with AND and never regroup
// - Group order is fixed; empty groups are omitted; overdue header hides on that filter
// - Overdue rows stay visible under Today, This week, and All
// - Completed rows ignore period but still match search and project
// - Three empty-state branches
//
// What is covered:
// - Query, membership isolation, Done identity, AND filters, overdue-across-periods,
//   group order, completed vs period, empty states, query count
//
// Run with: pnpm test:run tests/lib/myTasks.test.ts
//
// SEE: src/lib/myTasks.ts

import { beforeEach, describe, expect, it } from 'vitest';

import type { BoardAccess } from '@/lib/membership';
import {
  countOpenMyTasksForUser,
  filterCompletedMyTasks,
  filterOpenMyTasks,
  groupMyTasks,
  listMyTasksForUser,
  myTaskProjectChips,
  myTasksEmptyKind,
  myTasksHasLate,
  myTasksSummary,
  taskDueGroup,
  type MyTask,
} from '@/lib/myTasks';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
const now = new Date(2026, 7, 26, 12, 0, 0);

function day(year: number, month: number, date: number): Date {
  return new Date(Date.UTC(year, month - 1, date));
}

function task(overrides: Partial<MyTask> & Pick<MyTask, 'id' | 'title'>): MyTask {
  return {
    dueDate: null,
    dueTimeZone: null,
    label: null,
    subtasks: [],
    assignees: [{ id: 'user-ada', name: 'Ada', username: 'ada' }],
    project: { id: 'proj-sprint', title: 'Sprint board', access: 'EDIT' },
    columnId: 'col-todo',
    completed: false,
    ...overrides,
  };
}

describe('taskDueGroup', () => {
  it('buckets overdue, today, this week, later, and no date', () => {
    expect(taskDueGroup(task({ id: '1', title: 'None' }), now)).toBe('nodate');
    expect(taskDueGroup(task({ id: '2', title: 'Late', dueDate: day(2026, 8, 25) }), now)).toBe(
      'overdue',
    );
    expect(taskDueGroup(task({ id: '3', title: 'Today', dueDate: day(2026, 8, 26) }), now)).toBe(
      'today',
    );
    expect(taskDueGroup(task({ id: '4', title: 'Friday', dueDate: day(2026, 8, 28) }), now)).toBe(
      'week',
    );
    expect(taskDueGroup(task({ id: '5', title: 'Next', dueDate: day(2026, 8, 31) }), now)).toBe(
      'later',
    );
  });
});

describe('filterOpenMyTasks', () => {
  const late = task({
    id: 'late',
    title: 'Fix login',
    dueDate: day(2026, 8, 25),
    label: { id: 'l1', name: 'Bug', tone: 'red' },
  });
  const today = task({
    id: 'today',
    title: 'Ship grid',
    dueDate: day(2026, 8, 26),
    project: { id: 'proj-app', title: 'App mobile', access: 'EDIT' },
  });
  const week = task({ id: 'week', title: 'Write docs', dueDate: day(2026, 8, 28) });
  const later = task({ id: 'later', title: 'Migrate', dueDate: day(2026, 8, 31) });
  const none = task({ id: 'none', title: 'Backlog idea' });
  const done = task({
    id: 'done',
    title: 'Already shipped',
    completed: true,
    dueDate: day(2026, 8, 26),
  });
  const all = [late, today, week, later, none, done];

  it('combines search, project, and period with AND and keeps group identity', () => {
    const filtered = filterOpenMyTasks({
      tasks: all,
      query: 'grid',
      projectId: 'proj-app',
      period: 'today',
      now,
    });

    expect(filtered.map((item) => item.id)).toEqual(['today']);
    expect(taskDueGroup(filtered[0]!, now)).toBe('today');
  });

  it('searches title, project, and label without changing order', () => {
    const byLabel = filterOpenMyTasks({
      tasks: all,
      query: 'bug',
      projectId: null,
      period: 'all',
      now,
    });
    const byProject = filterOpenMyTasks({
      tasks: all,
      query: 'mobile',
      projectId: null,
      period: 'all',
      now,
    });

    expect(byLabel.map((item) => item.id)).toEqual(['late']);
    expect(byProject.map((item) => item.id)).toEqual(['today']);
  });

  it('keeps overdue rows under today, this week, and all', () => {
    const todayIds = filterOpenMyTasks({
      tasks: all,
      query: '',
      projectId: null,
      period: 'today',
      now,
    }).map((item) => item.id);
    const weekIds = filterOpenMyTasks({
      tasks: all,
      query: '',
      projectId: null,
      period: 'week',
      now,
    }).map((item) => item.id);

    expect(todayIds).toEqual(['late', 'today']);
    expect(weekIds).toEqual(['late', 'today', 'week']);
    expect(
      filterOpenMyTasks({ tasks: all, query: '', projectId: null, period: 'overdue', now }).map(
        (item) => item.id,
      ),
    ).toEqual(['late']);
  });

  it('drops completed rows from the open list', () => {
    expect(
      filterOpenMyTasks({ tasks: all, query: '', projectId: null, period: 'all', now }).map(
        (item) => item.id,
      ),
    ).not.toContain('done');
  });
});

describe('groupMyTasks', () => {
  it('renders groups in fixed order, omits empty ones, and hides the overdue header on that filter', () => {
    const tasks = [
      task({ id: 'later', title: 'Later', dueDate: day(2026, 8, 31) }),
      task({ id: 'late', title: 'Late', dueDate: day(2026, 8, 25) }),
      task({ id: 'today', title: 'Today', dueDate: day(2026, 8, 26) }),
    ];
    const groups = groupMyTasks(tasks, now, null, 'all');

    expect(groups.map((group) => group.key)).toEqual(['overdue', 'today', 'later']);
    expect(groups[0]?.showHeader).toBe(true);
    expect(groupMyTasks(tasks, now, null, 'overdue')[0]?.showHeader).toBe(false);
  });
});

describe('filterCompletedMyTasks', () => {
  it('matches search and project but ignores period', () => {
    const completed = task({
      id: 'done',
      title: 'Shipped login',
      completed: true,
      dueDate: day(2026, 8, 25),
      project: { id: 'proj-app', title: 'App mobile', access: 'EDIT' },
    });
    const other = task({ id: 'open', title: 'Open login', dueDate: day(2026, 8, 26) });

    expect(
      filterCompletedMyTasks({
        tasks: [completed, other],
        query: 'login',
        projectId: 'proj-app',
      }).map((item) => item.id),
    ).toEqual(['done']);
  });
});

describe('empty kind, summary, chips, and overdue presence', () => {
  it('picks the three empty states', () => {
    expect(
      myTasksEmptyKind({
        openGroups: 0,
        query: 'zebra',
        openMatchingSearchAndProject: 0,
        completedMatching: 0,
      }),
    ).toBe('search');
    expect(
      myTasksEmptyKind({
        openGroups: 0,
        query: '',
        openMatchingSearchAndProject: 0,
        completedMatching: 2,
      }),
    ).toBe('allDone');
    expect(
      myTasksEmptyKind({
        openGroups: 0,
        query: '',
        openMatchingSearchAndProject: 3,
        completedMatching: 0,
      }),
    ).toBe('nothingPending');
    expect(
      myTasksEmptyKind({
        openGroups: 1,
        query: '',
        openMatchingSearchAndProject: 1,
        completedMatching: 0,
      }),
    ).toBeNull();
  });

  it('pluralizes the summary from the filtered open list', () => {
    expect(myTasksSummary([], now)).toBe('0 open tasks');
    expect(myTasksSummary([task({ id: '1', title: 'One', dueDate: day(2026, 8, 26) })], now)).toBe(
      '1 open task',
    );
    expect(
      myTasksSummary(
        [
          task({ id: '1', title: 'Late', dueDate: day(2026, 8, 25) }),
          task({ id: '2', title: 'Today', dueDate: day(2026, 8, 26) }),
        ],
        now,
      ),
    ).toBe('2 open tasks · 1 overdue');
  });

  it('builds chips from first-seen projects and detects overdue after search and project', () => {
    const tasks = [
      task({ id: 'a', title: 'A', project: { id: 'p1', title: 'One', access: 'EDIT' } }),
      task({ id: 'b', title: 'B', project: { id: 'p2', title: 'Two', access: 'VIEW' } }),
      task({ id: 'c', title: 'C', project: { id: 'p1', title: 'One', access: 'EDIT' } }),
    ];
    expect(myTaskProjectChips(tasks)).toEqual([
      { id: 'p1', title: 'One' },
      { id: 'p2', title: 'Two' },
    ]);
    expect(
      myTasksHasLate(
        [task({ id: 'late', title: 'Late', dueDate: day(2026, 8, 25) })],
        '',
        null,
        now,
      ),
    ).toBe(true);
  });
});

describe('listMyTasksForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  async function seedBoard(
    title: string,
    userId: string,
    options?: { access?: BoardAccess; role?: 'OWNER' | 'ADMIN' | 'MEMBER' },
  ) {
    const project = await seedAccessibleProject(db, {
      title,
      userId,
      access: options?.access,
      role: options?.role,
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 0, projectId: project.id },
    });
    const done = await db.column.create({
      data: { title: 'Done', order: 1, projectId: project.id },
    });
    return { project, todo, done };
  }

  async function seedAssigned(
    columnId: string,
    input: {
      userId: string;
      title: string;
      archivedAt?: Date | null;
      dueDate?: Date | null;
      labelId?: string | null;
    },
  ) {
    const card = await db.card.create({
      data: {
        title: input.title,
        columnId,
        archivedAt: input.archivedAt ?? null,
        dueDate: input.dueDate ?? null,
        labelId: input.labelId ?? null,
      },
    });
    await db.cardAssignee.create({
      data: { cardId: card.id, userId: input.userId },
    });
    return card;
  }

  it('returns assigned cards across projects and counts open ones', async () => {
    const sprint = await seedBoard('Sprint board', 'user-ada');
    const app = await seedBoard('App mobile', 'user-ada');
    const open = await seedAssigned(sprint.todo.id, { userId: 'user-ada', title: 'Open card' });
    await seedAssigned(sprint.done.id, { userId: 'user-ada', title: 'Finished' });
    await seedAssigned(app.todo.id, { userId: 'user-ada', title: 'Phone polish' });
    await seedAssigned(sprint.todo.id, {
      userId: 'user-ada',
      title: 'Archived',
      archivedAt: new Date('2026-08-20'),
    });

    const list = await listMyTasksForUser(db, 'user-ada');

    expect(list.tasks.map((item) => item.title).sort()).toEqual([
      'Finished',
      'Open card',
      'Phone polish',
    ]);
    expect(list.tasks.find((item) => item.id === open.id)?.completed).toBe(false);
    expect(list.tasks.find((item) => item.title === 'Finished')?.completed).toBe(true);
    expect(list.openCount).toBe(2);
    expect(list.createProjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Sprint board', inboxColumnId: sprint.todo.id }),
      ]),
    );
    expect(await countOpenMyTasksForUser(db, 'user-ada')).toBe(2);
  });

  it('treats the last column as Done when none is titled Done', async () => {
    const project = await seedAccessibleProject(db, { title: 'Marketing', userId: 'user-ada' });
    const ideas = await db.column.create({
      data: { title: 'Ideas', order: 0, projectId: project.id },
    });
    const published = await db.column.create({
      data: { title: 'Published', order: 1, projectId: project.id },
    });
    await seedAssigned(published.id, { userId: 'user-ada', title: 'Live' });
    await seedAssigned(ideas.id, { userId: 'user-ada', title: 'Draft' });

    const list = await listMyTasksForUser(db, 'user-ada');

    expect(list.tasks.find((item) => item.title === 'Live')?.completed).toBe(true);
    expect(list.tasks.find((item) => item.title === 'Draft')?.completed).toBe(false);
    expect(list.createProjects[0]?.inboxColumnId).toBe(ideas.id);
  });

  it('does not list assignments on a project the user left', async () => {
    const mine = await seedBoard('Sprint board', 'user-ada');
    const left = await db.project.create({ data: { title: 'Old board', ownerId: 'user-other' } });
    const leftover = await db.column.create({
      data: { title: 'To do', order: 0, projectId: left.id },
    });
    await seedAssigned(mine.todo.id, { userId: 'user-ada', title: 'Mine' });
    await seedAssigned(leftover.id, { userId: 'user-ada', title: 'Stale' });

    const list = await listMyTasksForUser(db, 'user-ada');

    expect(list.tasks.map((item) => item.title)).toEqual(['Mine']);
  });

  it("does not list other people's cards", async () => {
    const sprint = await seedBoard('Sprint board', 'user-ada');
    await seedAssigned(sprint.todo.id, { userId: 'user-ada', title: 'Mine' });
    const other = await db.card.create({
      data: { title: 'Theirs', columnId: sprint.todo.id },
    });
    await db.cardAssignee.create({ data: { cardId: other.id, userId: 'user-other' } });

    const list = await listMyTasksForUser(db, 'user-ada');

    expect(list.tasks.map((item) => item.title)).toEqual(['Mine']);
  });

  it('omits VIEW projects from the create list and keeps their tasks', async () => {
    const viewed = await seedBoard('Read only', 'user-ada', { access: 'VIEW', role: 'MEMBER' });
    await seedAssigned(viewed.todo.id, { userId: 'user-ada', title: 'Watch this' });

    const list = await listMyTasksForUser(db, 'user-ada');

    expect(list.tasks[0]?.project.access).toBe('VIEW');
    expect(list.createProjects).toEqual([]);
  });

  it('loads assignments once for every project', async () => {
    const one = await seedBoard('One', 'user-ada');
    await seedBoard('Two', 'user-ada');
    await seedAssigned(one.todo.id, { userId: 'user-ada', title: 'Mine' });
    db.cardAssignee.findMany.mockClear();
    db.card.findMany.mockClear();

    await listMyTasksForUser(db, 'user-ada');

    expect(db.cardAssignee.findMany).toHaveBeenCalledTimes(2);
    expect(db.card.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list when the user has no memberships', async () => {
    await db.project.create({ data: { title: 'Other', ownerId: 'user-other' } });

    expect(await listMyTasksForUser(db, 'user-ada')).toEqual({
      tasks: [],
      createProjects: [],
      openCount: 0,
    });
  });
});
