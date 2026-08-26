// tests/actions/setCardCompleted.test.ts
//
// Tests for the setCardCompleted server action.
//
// Tested:
// - Completing moves the card into a titled Done column
// - Completing falls back to the last column when none is titled Done
// - Uncompleting moves the card to the inbox column
// - Uncompleting skips extra Done-titled columns and lands on the first other column
// - Uncompleting an already-open card does not move it
// - Returns a named error when there is no inbox
// - Rejects VIEW access and missing sessions
// - Occupancy updateMany count !== 1 returns Unauthorized
// - Rejects an empty, oversized, or non-string id without a lookup
//
// What is covered:
// - Happy path complete/uncomplete, extra Done titles skipped for inbox, Done fallback, named errors, authorization,
//   occupancy, invalid id
//
// Run with: pnpm test:run tests/actions/setCardCompleted.test.ts
//
// SEE: src/actions/setCardCompleted.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NO_OPEN_COLUMN_MESSAGE } from '@/lib/messages';
import { MAX_ID_LENGTH } from '@/lib/validation/id';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
const getSession = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/cache', () => ({
  revalidatePath,
}));

const { setCardCompleted } = await import('@/actions/setCardCompleted');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

async function seedBoard(options?: { access?: 'EDIT' | 'COMMENT' | 'VIEW'; withDone?: boolean }) {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
    access: options?.access,
  });
  const todo = await db.column.create({
    data: { title: 'To do', order: 0, projectId: project.id },
  });
  const done =
    options?.withDone === false
      ? null
      : await db.column.create({
          data: { title: 'Done', order: 1, projectId: project.id },
        });
  const card = await db.card.create({
    data: {
      title: 'Ship it',
      description: null,
      code: 'SB-1',
      order: 1,
      columnId: todo.id,
    },
  });
  return { project, todo, done, card };
}

describe('setCardCompleted', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('moves a card into the Done column', async () => {
    const { project, todo, done, card } = await seedBoard();

    const result = await setCardCompleted({ cardId: card.id, completed: true });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: card.id,
        columnId: done!.id,
        completed: true,
      }),
    });
    expect(db.card.rows.find((row) => row.id === card.id)).toEqual(
      expect.objectContaining({ columnId: done!.id }),
    );
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'CARD_MOVED',
        projectId: project.id,
        payload: expect.objectContaining({
          fromColumnTitle: 'To do',
          toColumnTitle: 'Done',
        }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
    expect(todo.id).not.toBe(done!.id);
  });

  it('falls back to the last column when none is titled Done', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Marketing',
      userId: sessionUser.id,
    });
    const ideas = await db.column.create({
      data: { title: 'Ideas', order: 0, projectId: project.id },
    });
    const published = await db.column.create({
      data: { title: 'Published', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Campaign', code: 'MK-1', order: 1, columnId: ideas.id },
    });

    const result = await setCardCompleted({ cardId: card.id, completed: true });

    expect(result).toEqual({
      data: expect.objectContaining({ columnId: published.id, completed: true }),
    });
  });

  it('moves a completed card back to the inbox column', async () => {
    const { todo, done, card } = await seedBoard();
    await db.card.update({ where: { id: card.id }, data: { columnId: done!.id } });

    const result = await setCardCompleted({ cardId: card.id, completed: false });

    expect(result).toEqual({
      data: expect.objectContaining({ columnId: todo.id, completed: false }),
    });
  });

  it('uncompletes into the first non-Done column when two columns are titled Done', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const firstDone = await db.column.create({
      data: { title: 'Done', order: 0, projectId: project.id },
    });
    const secondDone = await db.column.create({
      data: { title: 'Done', order: 1, projectId: project.id },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 2, projectId: project.id },
    });
    const card = await db.card.create({
      data: {
        title: 'Ship it',
        code: 'SB-1',
        order: 1,
        columnId: firstDone.id,
      },
    });

    const result = await setCardCompleted({ cardId: card.id, completed: false });

    expect(result).toEqual({
      data: expect.objectContaining({ columnId: todo.id, completed: false }),
    });
    expect(db.card.rows.find((row) => row.id === card.id)).toEqual(
      expect.objectContaining({ columnId: todo.id }),
    );
    expect(secondDone.id).not.toBe(todo.id);
  });

  it('does not move an already-open card when marking it pending', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 0, projectId: project.id },
    });
    const doing = await db.column.create({
      data: { title: 'In progress', order: 1, projectId: project.id },
    });
    await db.column.create({
      data: { title: 'Done', order: 2, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Ship it', code: 'SB-1', order: 1, columnId: doing.id },
    });

    const result = await setCardCompleted({ cardId: card.id, completed: false });

    expect(result).toEqual({
      data: expect.objectContaining({ columnId: doing.id, completed: false }),
    });
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(todo.id).toBeTruthy();
  });

  it('returns a named error when uncompleting on a single-column board', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Done only',
      userId: sessionUser.id,
    });
    const done = await db.column.create({
      data: { title: 'Done', order: 0, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Ship it', code: 'DO-1', order: 1, columnId: done.id },
    });

    expect(await setCardCompleted({ cardId: card.id, completed: false })).toEqual({
      error: NO_OPEN_COLUMN_MESSAGE,
    });
  });

  it('rejects VIEW access', async () => {
    const { card } = await seedBoard({ access: 'VIEW' });

    expect(await setCardCompleted({ cardId: card.id, completed: true })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.card.updateMany).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { card } = await seedBoard();

    expect(await setCardCompleted({ cardId: card.id, completed: true })).toEqual({
      error: 'Unauthorized',
    });
  });

  it('returns Unauthorized when occupancy does not claim the row', async () => {
    const { card } = await seedBoard();
    db.card.updateMany.mockResolvedValueOnce({ count: 0 });

    expect(await setCardCompleted({ cardId: card.id, completed: true })).toEqual({
      error: 'Unauthorized',
    });
  });

  it('rejects an empty, oversized, or non-string id without a lookup', async () => {
    expect(await setCardCompleted({ cardId: '', completed: true })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await setCardCompleted({ cardId: 'a'.repeat(MAX_ID_LENGTH + 1), completed: true }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await setCardCompleted({ cardId: 1 as unknown as string, completed: true })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
