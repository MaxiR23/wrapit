// tests/lib/kanbanItems.test.ts
//
// Tests for column-level board moves (append only).
//
// Tested:
// - findContainer returns the column that holds a card
// - placeCardInColumn appends at the end of the target
// - Moving to the current column is a no-op commit
// - Missing card or target yields no commit
//
// What is covered:
// - Append move, no-op, missing ids
//
// Run with: pnpm test:run tests/lib/kanbanItems.test.ts
//
// SEE: src/lib/kanbanItems.ts

import { describe, it, expect } from 'vitest';

import { commitMoveToColumn, findContainer, placeCardInColumn } from '@/lib/kanbanItems';

const board = {
  todo: ['a', 'b', 'c'],
  doing: ['d', 'e'],
  done: [] as string[],
};

describe('findContainer', () => {
  it('finds the column that holds a card', () => {
    expect(findContainer(board, 'b')).toBe('todo');
    expect(findContainer(board, 'e')).toBe('doing');
    expect(findContainer(board, 'missing')).toBeUndefined();
  });
});

describe('placeCardInColumn', () => {
  it('appends the card at the end of the target column', () => {
    expect(placeCardInColumn(board, 'a', 'doing')).toEqual({
      todo: ['b', 'c'],
      doing: ['d', 'e', 'a'],
      done: [],
    });
    expect(placeCardInColumn(board, 'a', 'done')).toEqual({
      todo: ['b', 'c'],
      doing: ['d', 'e'],
      done: ['a'],
    });
  });

  it('keeps position when the card is already in the target column', () => {
    expect(placeCardInColumn(board, 'a', 'todo')).toEqual(board);
    expect(placeCardInColumn(board, 'd', 'doing')).toEqual(board);
  });
});

describe('commitMoveToColumn', () => {
  it('commits a cross-column append', () => {
    const { items, commit } = commitMoveToColumn(board, 'a', 'doing');
    expect(items).toEqual({
      todo: ['b', 'c'],
      doing: ['d', 'e', 'a'],
      done: [],
    });
    expect(commit).toEqual({ cardId: 'a', targetColumnId: 'doing' });
  });

  it('does not commit when the card is already in the target column', () => {
    const { items, commit } = commitMoveToColumn(board, 'a', 'todo');
    expect(items).toBe(board);
    expect(commit).toBeNull();
  });

  it('does not commit when the card or target is missing', () => {
    expect(commitMoveToColumn(board, 'missing', 'doing').commit).toBeNull();
    expect(commitMoveToColumn(board, 'a', 'missing').commit).toBeNull();
  });
});
