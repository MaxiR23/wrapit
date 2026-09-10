// tests/lib/myTasks.cache.test.ts
//
// Tests that list and count share one assigned-context load per request.
//
// Tested:
// - listMyTasksForUser and countOpenMyTasksForUser load assigned context once
// - A later request loads assigned context again
//
// What is covered:
// - React.cache on loadAssignedContext. jsdom's client React makes cache() a
//   no-op, so this file installs a request-scoped stand-in.
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

describe('assigned context request memo', () => {
  beforeEach(() => {
    db.reset();
    resetRequestCache();
  });

  it('loads the assigned context once when listing and counting in one request', async () => {
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

    const list = await listMyTasksForUser(db, 'user-ada');
    const openCount = await countOpenMyTasksForUser(db, 'user-ada');

    expect(list.openCount).toBe(1);
    expect(openCount).toBe(1);
    expect(db.membership.findMany).toHaveBeenCalledTimes(1);
  });

  it('loads the assigned context again on a later request', async () => {
    await seedAccessibleProject(db, { title: 'Sprint board', userId: 'user-ada' });
    db.membership.findMany.mockClear();

    await countOpenMyTasksForUser(db, 'user-ada');
    resetRequestCache();
    await countOpenMyTasksForUser(db, 'user-ada');

    expect(db.membership.findMany).toHaveBeenCalledTimes(2);
  });
});
