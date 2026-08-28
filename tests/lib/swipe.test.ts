// tests/lib/swipe.test.ts
//
// Tests for shared row-swipe thresholds and end resolution.
//
// Tested:
// - A short drag closes
// - A medium drag rests open
// - A long drag commits
//
// What is covered:
// - Conservative swipe bands used by archived rows and the projects list
//
// Run with: pnpm test:run tests/lib/swipe.test.ts
//
// SEE: src/lib/swipe.ts

import { describe, it, expect } from 'vitest';

import { resolveSwipeEnd, SWIPE_COMMIT_PX, SWIPE_OPEN_PX, SWIPE_REST_PX } from '@/lib/swipe';

describe('resolveSwipeEnd', () => {
  it('closes a short drag', () => {
    expect(resolveSwipeEnd(SWIPE_OPEN_PX)).toEqual({ restDx: 0, commit: null });
    expect(resolveSwipeEnd(-SWIPE_OPEN_PX)).toEqual({ restDx: 0, commit: null });
  });

  it('rests open on a medium drag', () => {
    expect(resolveSwipeEnd(SWIPE_OPEN_PX + 1)).toEqual({ restDx: SWIPE_REST_PX, commit: null });
    expect(resolveSwipeEnd(-(SWIPE_OPEN_PX + 1))).toEqual({ restDx: -SWIPE_REST_PX, commit: null });
  });

  it('commits a long drag', () => {
    expect(resolveSwipeEnd(SWIPE_COMMIT_PX + 1)).toEqual({ restDx: 0, commit: 'positive' });
    expect(resolveSwipeEnd(-(SWIPE_COMMIT_PX + 1))).toEqual({ restDx: 0, commit: 'negative' });
  });
});
