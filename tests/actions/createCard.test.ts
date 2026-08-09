// tests/actions/createCard.test.ts
//
// Tests for the createCard server action.
//
// Tested:
// - Creates a card on the owner's column with an appending order
// - Accepts an optional description
// - Rejects an empty title with a clear field error
// - Rejects creating on a column the user does not own
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, optional description, invalid input, ownership, unauthorized, unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/createCard.test.ts
//
// SEE: src/actions/createCard.ts

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

const { createCard } = await import('@/actions/createCard');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

async function seedOwnedColumn() {
  const board = await db.board.create({
    data: { title: 'Sprint board', ownerId: sessionUser.id },
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 1, boardId: board.id },
  });
  return { board, column };
}

describe('createCard', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a card on the owner column with an appending order', async () => {
    const { board, column } = await seedOwnedColumn();
    await db.card.create({
      data: { title: 'First', order: 1, columnId: column.id },
    });

    const result = await createCard({ columnId: column.id, title: 'Second' });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Second',
        columnId: column.id,
        order: 2,
        description: null,
      }),
    });
    expect(db.card.rows).toHaveLength(2);
    expect(revalidatePath).toHaveBeenCalledWith(`/boards/${board.id}`);
  });

  it('assigns order 1 when the column has no cards yet', async () => {
    const { column } = await seedOwnedColumn();

    const result = await createCard({ columnId: column.id, title: 'First' });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'First',
        order: 1,
      }),
    });
  });

  it('accepts an optional description', async () => {
    const { column } = await seedOwnedColumn();

    const result = await createCard({
      columnId: column.id,
      title: 'Write tests',
      description: 'Cover ownership',
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Write tests',
        description: 'Cover ownership',
      }),
    });
  });

  it('rejects an empty title with a clear field error', async () => {
    const { column } = await seedOwnedColumn();

    const result = await createCard({ columnId: column.id, title: '' });

    expect(result).toEqual({ fieldErrors: { title: 'Title is required' } });
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects creating on a column the user does not own', async () => {
    const board = await db.board.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });

    const result = await createCard({ columnId: column.id, title: 'Stolen' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { column } = await seedOwnedColumn();

    const result = await createCard({ columnId: column.id, title: 'Write tests' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { column } = await seedOwnedColumn();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.create.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await createCard({ columnId: column.id, title: 'Write tests' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
