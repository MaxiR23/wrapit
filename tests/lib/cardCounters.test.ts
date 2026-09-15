// tests/lib/cardCounters.test.ts
//
// Tests for board and detail comment/subtask counters.
//
// Tested:
// - Comment count is the list length, including zero
// - Subtask progress is done over total, including 0/0
// - Face comment count prefers the loaded list over a preloaded number
// - Face subtask progress prefers the loaded list over preloaded numbers
//
// What is covered:
// - Empty lists, mixed done flags, loaded list vs preloaded face counts
//
// Run with: pnpm test:run tests/lib/cardCounters.test.ts
//
// SEE: src/lib/cardCounters.ts

import { describe, it, expect } from 'vitest';

import {
  commentCount,
  faceCommentCount,
  faceSubtaskProgress,
  subtaskProgress,
} from '@/lib/cardCounters';

describe('commentCount', () => {
  it('returns the list length including zero', () => {
    expect(commentCount([])).toBe(0);
    expect(commentCount([{}, {}])).toBe(2);
  });
});

describe('subtaskProgress', () => {
  it('returns 0/0 for an empty list', () => {
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0 });
  });

  it('counts done over total', () => {
    expect(subtaskProgress([{ done: true }, { done: false }, { done: true }])).toEqual({
      done: 2,
      total: 3,
    });
  });
});

describe('faceCommentCount', () => {
  it('uses the preloaded count when comments are not loaded', () => {
    expect(faceCommentCount({ commentCount: 4 })).toBe(4);
    expect(faceCommentCount({})).toBe(0);
  });

  it('prefers the loaded list over a stale preloaded count', () => {
    expect(faceCommentCount({ commentCount: 4, comments: [{}] })).toBe(1);
    expect(faceCommentCount({ commentCount: 4, comments: [] })).toBe(0);
  });
});

describe('faceSubtaskProgress', () => {
  it('uses preloaded numbers when subtasks are not loaded', () => {
    expect(faceSubtaskProgress({ subtaskDone: 2, subtaskTotal: 5 })).toEqual({ done: 2, total: 5 });
    expect(faceSubtaskProgress({})).toEqual({ done: 0, total: 0 });
  });

  it('prefers the loaded list over stale preloaded numbers', () => {
    expect(
      faceSubtaskProgress({
        subtaskDone: 2,
        subtaskTotal: 5,
        subtasks: [{ done: true }, { done: false }, { done: false }],
      }),
    ).toEqual({ done: 1, total: 3 });
  });
});
