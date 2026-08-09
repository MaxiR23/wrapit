// tests/actions/deleteCard.test.ts
//
// Tests for the deleteCard server action.
//
// Tested:
// - Deletes a card that belongs to the signed-in user's board
// - Rejects deleting a card on another user's board
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, ownership, unauthorized, unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/deleteCard.test.ts
//
// SEE: src/actions/deleteCard.ts

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

const { deleteCard } = await import('@/actions/deleteCard');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

describe('deleteCard', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('deletes a card that belongs to the signed-in user board', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });
    const card = await db.card.create({
      data: { title: 'Write tests', order: 1, columnId: column.id },
    });

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ data: { id: card.id } });
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith(`/boards/${board.id}`);
  });

  it('rejects deleting a card on another user board', async () => {
    const board = await db.board.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });
    const card = await db.card.create({
      data: { title: 'Write tests', order: 1, columnId: column.id },
    });

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });
    const card = await db.card.create({
      data: { title: 'Write tests', order: 1, columnId: column.id },
    });
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.delete.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.card.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
