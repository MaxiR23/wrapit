// tests/lib/kanbanItems.test.ts
//
// Tests for pure kanban board transitions.
//
// Tested:
// - Same column: start, middle, end, empty container area
// - Other column: empty, start, middle, end, destination change during drag
// - Neighbors / placeCardBetween reconciliation
//
// What is covered:
// - Full drag-over and drag-end transition matrix
//
// Run with: pnpm test:run tests/lib/kanbanItems.test.ts
//
// SEE: src/lib/kanbanItems.ts

import { describe, it, expect } from 'vitest';

import {
  findContainer,
  neighborsAt,
  placeCardAtOver,
  placeCardBetween,
  reorderInColumn,
  transitionDragEnd,
  transitionDragOver,
} from '@/lib/kanbanItems';

const board = {
  todo: ['a', 'b', 'c'],
  doing: ['d', 'e'],
  done: [] as string[],
};

describe('kanbanItems helpers', () => {
  it('finds the container for a card id', () => {
    expect(findContainer(board, 'b')).toBe('todo');
    expect(findContainer(board, 'e')).toBe('doing');
    expect(findContainer(board, 'missing')).toBeUndefined();
  });

  it('returns neighbors around an index', () => {
    expect(neighborsAt(['a', 'b', 'c'], 1)).toEqual({
      beforeCardId: 'a',
      afterCardId: 'c',
    });
  });

  it('places before a card or appends on column over id', () => {
    expect(placeCardAtOver(board, 'a', 'doing', 'd')).toEqual({
      todo: ['b', 'c'],
      doing: ['a', 'd', 'e'],
      done: [],
    });
    expect(placeCardAtOver(board, 'a', 'doing', 'doing')).toEqual({
      todo: ['b', 'c'],
      doing: ['d', 'e', 'a'],
      done: [],
    });
  });

  it('reconciles by neighbors preferring ones that still exist', () => {
    expect(placeCardBetween(board, 'b', 'doing', 'missing', 'd')).toEqual({
      todo: ['a', 'c'],
      doing: ['b', 'd', 'e'],
      done: [],
    });
  });
});

describe('transitionDragOver / transitionDragEnd — same column', () => {
  const start = { todo: ['a', 'b', 'c'], doing: ['d'] };

  it('moves to the start within the same column on drag end', () => {
    const { items, commit } = transitionDragEnd(start, start, 'c', 'a');
    expect(items.todo).toEqual(['c', 'a', 'b']);
    expect(commit).toEqual({
      cardId: 'c',
      targetColumnId: 'todo',
      beforeCardId: null,
      afterCardId: 'a',
    });
  });

  it('moves to the middle within the same column on drag end', () => {
    const { items, commit } = transitionDragEnd(start, start, 'c', 'b');
    expect(items.todo).toEqual(['a', 'c', 'b']);
    expect(commit).toEqual({
      cardId: 'c',
      targetColumnId: 'todo',
      beforeCardId: 'a',
      afterCardId: 'b',
    });
  });

  it('moves to the end within the same column when dropping on the last card', () => {
    expect(reorderInColumn(start, 'todo', 'a', 'c').todo).toEqual(['b', 'c', 'a']);
  });

  it('moves to the end when dropping on the empty area of its own column', () => {
    const { items, commit } = transitionDragEnd(start, start, 'a', 'todo');
    expect(items.todo).toEqual(['b', 'c', 'a']);
    expect(commit).toEqual({
      cardId: 'a',
      targetColumnId: 'todo',
      beforeCardId: 'c',
      afterCardId: null,
    });
  });

  it('no-ops when dropping a card on itself', () => {
    const { items, commit } = transitionDragEnd(start, start, 'b', 'b');
    expect(items).toEqual(start);
    expect(commit).toBeNull();
  });
});

describe('transitionDragOver / transitionDragEnd — other column', () => {
  const start = { todo: ['a', 'b'], doing: ['c', 'd'], done: [] as string[] };

  it('moves into an empty column', () => {
    const over = transitionDragOver(start, start, 'a', 'done');
    expect(over).toEqual({ todo: ['b'], doing: ['c', 'd'], done: ['a'] });

    const end = transitionDragEnd(start, over, 'a', 'done');
    expect(end.items.done).toEqual(['a']);
    expect(end.commit).toEqual({
      cardId: 'a',
      targetColumnId: 'done',
      beforeCardId: null,
      afterCardId: null,
    });
  });

  it('moves to the start of another column', () => {
    const over = transitionDragOver(start, start, 'a', 'c');
    expect(over.doing).toEqual(['a', 'c', 'd']);
    expect(transitionDragEnd(start, over, 'a', 'c').items.doing).toEqual(['a', 'c', 'd']);
  });

  it('moves to the middle of another column', () => {
    const over = transitionDragOver(start, start, 'a', 'd');
    expect(over.doing).toEqual(['c', 'a', 'd']);
  });

  it('moves to the end of another column via column droppable', () => {
    const over = transitionDragOver(start, start, 'a', 'doing');
    expect(over.doing).toEqual(['c', 'd', 'a']);
  });

  it('changes destination during drag: enter C then hover D', () => {
    const afterC = transitionDragOver(start, start, 'a', 'c');
    expect(afterC.doing).toEqual(['a', 'c', 'd']);

    const afterD = transitionDragOver(afterC, start, 'a', 'd');
    expect(afterD.doing).toEqual(['c', 'a', 'd']);

    const end = transitionDragEnd(start, afterD, 'a', 'd');
    expect(end.items.doing).toEqual(['c', 'a', 'd']);
    expect(end.commit).toEqual({
      cardId: 'a',
      targetColumnId: 'doing',
      beforeCardId: 'c',
      afterCardId: 'd',
    });
  });

  it('appends when dropping on the empty area after entering another column', () => {
    const afterC = transitionDragOver(start, start, 'a', 'c');
    const end = transitionDragEnd(start, afterC, 'a', 'doing');
    expect(end.items.doing).toEqual(['c', 'd', 'a']);
  });

  it('keeps position when hovering the active card after crossing columns', () => {
    // Enter over C → between B and C: [b, a, c]
    const afterC = transitionDragOver(
      { todo: ['a'], doing: ['b', 'c'] },
      { todo: ['a'], doing: ['b', 'c'] },
      'a',
      'c',
    );
    expect(afterC.doing).toEqual(['b', 'a', 'c']);

    const afterSelf = transitionDragOver(afterC, { todo: ['a'], doing: ['b', 'c'] }, 'a', 'a');
    expect(afterSelf.doing).toEqual(['b', 'a', 'c']);

    const end = transitionDragEnd({ todo: ['a'], doing: ['b', 'c'] }, afterSelf, 'a', 'a');
    expect(end.items.doing).toEqual(['b', 'a', 'c']);
    expect(end.commit).toEqual({
      cardId: 'a',
      targetColumnId: 'doing',
      beforeCardId: 'b',
      afterCardId: 'c',
    });
  });

  it('restores start items when the drop is cancelled', () => {
    const afterC = transitionDragOver(start, start, 'a', 'c');
    expect(transitionDragEnd(start, afterC, 'a', null)).toEqual({
      items: start,
      commit: null,
    });
  });
});
