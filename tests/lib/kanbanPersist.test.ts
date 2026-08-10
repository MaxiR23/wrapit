// tests/lib/kanbanPersist.test.ts
//
// Tests for pure persist reconciliation and queue finish reduction.
//
// Tested:
// - Reconcile job onto a persisted baseline by neighbors
// - Success with an empty remaining queue shows the new baseline
// - Success with remaining jobs rebuilds display as baseline + pending
// - Failure keeps the old baseline and still applies remaining pending jobs
//
// What is covered:
// - Persist queue reductions used by BoardKanban.commitMove
//
// Run with: pnpm test:run tests/lib/kanbanPersist.test.ts
//
// SEE: src/lib/kanbanPersist.ts

import { describe, it, expect } from 'vitest';

import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import {
  applyPendingJobs,
  isMoveCardErrorResult,
  persistPayloadFromReconciled,
  reconcilePersistJob,
  reducePersistFinish,
} from '@/lib/kanbanPersist';

describe('kanbanPersist', () => {
  const baseline = { todo: ['a', 'b'], doing: ['c'] };

  const moveB: Parameters<typeof reconcilePersistJob>[1] = {
    cardId: 'b',
    targetColumnId: 'doing',
    beforeCardId: null,
    afterCardId: 'c',
  };

  const moveA: Parameters<typeof reconcilePersistJob>[1] = {
    cardId: 'a',
    targetColumnId: 'doing',
    beforeCardId: 'b',
    afterCardId: 'c',
  };

  it('reconciles a job onto the persisted baseline by neighbors', () => {
    const reconciled = reconcilePersistJob(baseline, moveB);
    expect(reconciled).toEqual({ todo: ['a'], doing: ['b', 'c'] });
    expect(persistPayloadFromReconciled(reconciled, moveB)).toEqual({
      cardId: 'b',
      targetColumnId: 'doing',
      beforeCardId: null,
      afterCardId: 'c',
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
      persisted: { todo: ['a'], doing: ['b', 'c'] },
      display: { todo: ['a'], doing: ['b', 'c'] },
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
      persisted: { todo: ['a'], doing: ['b', 'c'] },
      display: { todo: [], doing: ['b', 'a', 'c'] },
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
      doing: ['b', 'c'],
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
