// tests/lib/boards.test.ts
//
// Tests for listing boards owned by a user.
//
// Tested:
// - Returns only boards owned by the given user
// - Returns boards newest first
// - Returns an empty list when the user has no boards
//
// What is covered:
// - Happy path, ownership isolation, empty list
//
// Run with: pnpm test:run tests/lib/boards.test.ts
//
// SEE: src/lib/boards.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { listBoardsForUser } = await import('@/lib/boards');

describe('listBoardsForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns only boards owned by the given user', async () => {
    await db.board.create({
      data: { title: 'Ada board', ownerId: 'user-ada', createdAt: new Date('2026-01-01') },
    });
    await db.board.create({
      data: { title: 'Other board', ownerId: 'user-other', createdAt: new Date('2026-01-02') },
    });

    const boards = await listBoardsForUser('user-ada');

    expect(boards).toHaveLength(1);
    expect(boards[0]?.title).toBe('Ada board');
    expect(boards.every((board) => board.ownerId === 'user-ada')).toBe(true);
  });

  it('returns boards newest first', async () => {
    await db.board.create({
      data: { title: 'Older', ownerId: 'user-ada', createdAt: new Date('2026-01-01') },
    });
    await db.board.create({
      data: { title: 'Newer', ownerId: 'user-ada', createdAt: new Date('2026-06-01') },
    });

    const boards = await listBoardsForUser('user-ada');

    expect(boards.map((board) => board.title)).toEqual(['Newer', 'Older']);
  });

  it('returns an empty list when the user has no boards', async () => {
    await db.board.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    expect(await listBoardsForUser('user-ada')).toEqual([]);
  });
});
