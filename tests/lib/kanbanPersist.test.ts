// tests/lib/kanbanPersist.test.ts
//
// Tests for pure persist reconciliation and queue finish reduction.
//
// Tested:
// - Reconcile job onto a persisted baseline by appending to the target
// - Source column for moveCard comes from the baseline, not the drag snapshot
// - Success with an empty remaining queue shows the new baseline
// - Success with remaining jobs rebuilds display as baseline + pending
// - Failure keeps the old baseline and still applies remaining pending jobs
//
// What is covered:
// - Persist queue reductions used by ProjectBoard.commitMove
//
// Run with: pnpm test:run tests/lib/kanbanPersist.test.ts
//
// SEE: src/lib/kanbanPersist.ts

import { describe, it, expect } from 'vitest';

import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import {
  applyPendingJobs,
  isMoveCardErrorResult,
  persistPayloadFromBaseline,
  reconcilePersistJob,
  reducePersistFinish,
} from '@/lib/kanbanPersist';

describe('kanbanPersist', () => {
  const baseline = { todo: ['a', 'b'], doing: ['c'] };

  const moveB = { cardId: 'b', targetColumnId: 'doing' };
  const moveA = { cardId: 'a', targetColumnId: 'doing' };

  it('reconciles a job onto the persisted baseline by appending', () => {
    const reconciled = reconcilePersistJob(baseline, moveB);
    expect(reconciled).toEqual({ todo: ['a'], doing: ['c', 'b'] });
    expect(persistPayloadFromBaseline(baseline, moveB)).toEqual({
      cardId: 'b',
      sourceColumnId: 'todo',
      targetColumnId: 'doing',
    });
  });

  it('on success with an empty queue, display equals the new persisted baseline', () => {
    expect(
      reducePersistFinish({
        persisted: baseline,
        finishedJob: moveB,
        remainingJobs: [],
        failed: false,
      }),
    ).toEqual({
      persisted: { todo: ['a'], doing: ['c', 'b'] },
      display: { todo: ['a'], doing: ['c', 'b'] },
      error: null,
    });
  });

  it('on success with remaining jobs, rebuilds display from new baseline + pending', () => {
    expect(
      reducePersistFinish({
        persisted: baseline,
        finishedJob: moveB,
        remainingJobs: [moveA],
        failed: false,
      }),
    ).toEqual({
      persisted: { todo: ['a'], doing: ['c', 'b'] },
      display: { todo: [], doing: ['c', 'b', 'a'] },
      error: null,
    });
  });

  it('on failure keeps the old baseline and still shows remaining pending jobs', () => {
    expect(
      reducePersistFinish({
        persisted: baseline,
        finishedJob: moveA,
        remainingJobs: [moveB],
        failed: true,
      }),
    ).toEqual({
      persisted: baseline,
      display: applyPendingJobs(baseline, [moveB]),
      error: GENERIC_ERROR_MESSAGE,
    });
    expect(applyPendingJobs(baseline, [moveB])).toEqual({
      todo: ['a'],
      doing: ['c', 'b'],
    });
  });

  it('on failure with an empty queue, display is the unchanged baseline', () => {
    expect(
      reducePersistFinish({
        persisted: baseline,
        finishedJob: moveB,
        remainingJobs: [],
        failed: true,
      }),
    ).toEqual({
      persisted: baseline,
      display: baseline,
      error: GENERIC_ERROR_MESSAGE,
    });
  });

  it('detects moveCard { error } results', () => {
    expect(isMoveCardErrorResult({ error: 'Something went wrong. Please try again.' })).toBe(true);
    expect(isMoveCardErrorResult({ data: { id: 'card-a' } })).toBe(false);
    expect(isMoveCardErrorResult(null)).toBe(false);
  });
});
