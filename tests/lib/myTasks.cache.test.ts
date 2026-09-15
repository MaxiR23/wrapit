// tests/lib/myTasks.cache.test.ts
//
// Tests that the open-task count is its own query, not the assigned-context load.
//
// Tested:
// - countOpenMyTasksForUser uses $queryRaw instead of membership.findMany
// - listMyTasksForUser still loads assigned context through membership.findMany
// - A later count request runs $queryRaw again
//
// What is covered:
// - The badge count does not share loadAssignedContext with the list.
//   jsdom's client React makes cache() a no-op, so this file still installs
//   a request-scoped stand-in for list memo tests if they land here later.
//
// Run with: pnpm test:run tests/lib/myTasks.cache.test.ts
//
// SEE: src/lib/myTasks.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRequestCache } from '../helpers/requestCache';
import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const { cache } = await import('../helpers/requestCache');
  return { ...actual, cache };
});

const { countOpenMyTasksForUser, listMyTasksForUser } = await import('@/lib/myTasks');

const db = createPrismaFake();

describe('open-task count query', () => {
  beforeEach(() => {
    db.reset();
    resetRequestCache();
  });

  it('counts in SQL and does not share assigned context with the list', async () => {
    const project = await seedAccessibleProject(db, { title: 'Sprint board', userId: 'user-ada' });
    const todo = await db.column.create({
      data: { title: 'To do', order: 0, projectId: project.id },
    });
    await db.column.create({
      data: { title: 'Done', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Open card', columnId: todo.id },
    });
    await db.cardAssignee.create({ data: { cardId: card.id, userId: 'user-ada' } });
    db.membership.findMany.mockClear();
    db.$queryRaw.mockClear();

    const list = await listMyTasksForUser(db, 'user-ada');
    const openCount = await countOpenMyTasksForUser(db, 'user-ada');

    expect(list.openCount).toBe(1);
    expect(openCount).toBe(1);
    expect(db.membership.findMany).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('runs the count query again on a later request', async () => {
    await seedAccessibleProject(db, { title: 'Sprint board', userId: 'user-ada' });
    db.$queryRaw.mockClear();
    db.membership.findMany.mockClear();

    await countOpenMyTasksForUser(db, 'user-ada');
    resetRequestCache();
    await countOpenMyTasksForUser(db, 'user-ada');

    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    expect(db.membership.findMany).not.toHaveBeenCalled();
  });
});
