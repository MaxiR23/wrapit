// tests/lib/ownership.test.ts
//
// Tests for column and card ownership helpers.
//
// Tested:
// - Resolves a column that belongs to the given user
// - Returns null for a column on another user's board
// - Resolves a card through column and board ownership
// - Returns null for a card on another user's board
//
// What is covered:
// - Full ownership chain for columns and cards
//
// Run with: pnpm test:run tests/lib/ownership.test.ts
//
// SEE: src/lib/ownership.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { getColumnForUser, getCardForUser } = await import('@/lib/ownership');

describe('getColumnForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('resolves a column that belongs to the given user', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });

    const result = await getColumnForUser(column.id, 'user-ada');

    expect(result).toEqual({
      column: expect.objectContaining({ id: column.id, title: 'To do' }),
      board: expect.objectContaining({ id: board.id, ownerId: 'user-ada' }),
    });
  });

  it('returns null for a column on another user board', async () => {
    const board = await db.board.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });

    expect(await getColumnForUser(column.id, 'user-ada')).toBeNull();
  });

  it('returns null for an unknown column id', async () => {
    expect(await getColumnForUser('missing-column', 'user-ada')).toBeNull();
  });
});

describe('getCardForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('resolves a card through column and board ownership', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });
    const card = await db.card.create({
      data: { title: 'Write tests', order: 1, columnId: column.id },
    });

    const result = await getCardForUser(card.id, 'user-ada');

    expect(result).toEqual({
      card: expect.objectContaining({ id: card.id, title: 'Write tests' }),
      column: expect.objectContaining({ id: column.id }),
      board: expect.objectContaining({ id: board.id, ownerId: 'user-ada' }),
    });
  });

  it('returns null for a card on another user board', async () => {
    const board = await db.board.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });

    expect(await getCardForUser(card.id, 'user-ada')).toBeNull();
  });

  it('returns null for an unknown card id', async () => {
    expect(await getCardForUser('missing-card', 'user-ada')).toBeNull();
  });
});
