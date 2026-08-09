// tests/actions/createColumn.test.ts
//
// Tests for the createColumn server action.
//
// Tested:
// - Creates a column on the owner's board with an appending order
// - Rejects an empty title with a clear field error
// - Rejects creating on a board the user does not own
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, invalid input, ownership, unauthorized, unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/createColumn.test.ts
//
// SEE: src/actions/createColumn.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

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

const { createColumn } = await import('@/actions/createColumn');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

describe('createColumn', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a column on the owner board with an appending order', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });
    await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });

    const result = await createColumn({ boardId: board.id, title: 'Done' });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Done',
        boardId: board.id,
        order: 2,
      }),
    });
    expect(db.column.rows).toHaveLength(2);
    expect(revalidatePath).toHaveBeenCalledWith(`/boards/${board.id}`);
  });

  it('assigns order 1 when the board has no columns yet', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });

    const result = await createColumn({ boardId: board.id, title: 'To do' });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'To do',
        order: 1,
      }),
    });
  });

  it('rejects an empty title with a clear field error', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });

    const result = await createColumn({ boardId: board.id, title: '' });

    expect(result).toEqual({ fieldErrors: { title: 'Title is required' } });
    expect(db.column.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects creating on a board the user does not own', async () => {
    const board = await db.board.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    const result = await createColumn({ boardId: board.id, title: 'Stolen' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.column.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });

    const result = await createColumn({ boardId: board.id, title: 'To do' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.column.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.column.create.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await createColumn({ boardId: board.id, title: 'To do' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
