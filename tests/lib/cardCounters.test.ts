// tests/lib/cardCounters.test.ts
//
// Tests for board and detail comment/subtask counters.
//
// Tested:
// - Comment count is the list length, including zero
// - Subtask progress is done over total, including 0/0
//
// What is covered:
// - Empty lists, mixed done flags
//
// Run with: pnpm test:run tests/lib/cardCounters.test.ts
//
// SEE: src/lib/cardCounters.ts

import { describe, it, expect } from 'vitest';

import { commentCount, subtaskProgress } from '@/lib/cardCounters';

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
