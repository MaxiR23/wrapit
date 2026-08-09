// tests/lib/boards.test.ts
//
// Tests for listing boards and loading a single board for a user.
//
// Tested:
// - Returns only boards owned by the given user
// - Returns boards newest first
// - Returns an empty list when the user has no boards
// - Returns the board with columns in order for the owner
// - Returns each column with its cards in order
// - Returns null for a non-owner or unknown board id
//
// What is covered:
// - Happy path, ownership isolation, empty list, board detail with cards
//
// Run with: pnpm test:run tests/lib/boards.test.ts
//
// SEE: src/lib/boards.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { listBoardsForUser, getBoardForUser } = await import('@/lib/boards');

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

describe('getBoardForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns the board with columns in order for the owner', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    await db.column.create({
      data: { title: 'Done', order: 2, boardId: board.id },
    });
    await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });

    const result = await getBoardForUser(board.id, 'user-ada');

    expect(result).toEqual(
      expect.objectContaining({
        id: board.id,
        title: 'Sprint board',
        ownerId: 'user-ada',
      }),
    );
    expect(result?.columns.map((column) => column.title)).toEqual(['To do', 'Done']);
    expect(result?.columns.every((column) => column.cards.length === 0)).toBe(true);
  });

  it('returns each column with its cards in order', async () => {
    const board = await db.board.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, boardId: board.id },
    });
    const done = await db.column.create({
      data: { title: 'Done', order: 2, boardId: board.id },
    });
    await db.card.create({
      data: { title: 'Second', order: 2, columnId: todo.id },
    });
    await db.card.create({
      data: { title: 'First', order: 1, columnId: todo.id },
    });
    await db.card.create({
      data: { title: 'Finished', order: 1, columnId: done.id },
    });

    const result = await getBoardForUser(board.id, 'user-ada');

    expect(result?.columns[0]?.cards.map((card) => card.title)).toEqual(['First', 'Second']);
    expect(result?.columns[1]?.cards.map((card) => card.title)).toEqual(['Finished']);
  });

  it('returns null for a non-owner', async () => {
    const board = await db.board.create({
      data: { title: 'Ada board', ownerId: 'user-ada' },
    });

    expect(await getBoardForUser(board.id, 'user-other')).toBeNull();
  });

  it('returns null for an unknown board id', async () => {
    expect(await getBoardForUser('missing-board', 'user-ada')).toBeNull();
  });
});
