// tests/lib/order.test.ts
//
// Tests for Float order placement between neighbors.
//
// Tested:
// - Empty list returns a starting order
// - Append after a single neighbor
// - Prepend before a single neighbor
// - Midpoint between two neighbors
// - Returns null when the gap cannot hold a distinct midpoint
// - Returns null when prepend/append extremes are exhausted
// - Rejects non-finite candidates
//
// What is covered:
// - Happy path and exhausted-precision signal for placement between neighbors
//
// Run with: pnpm test:run tests/lib/order.test.ts
//
// SEE: src/lib/order.ts

import { describe, it, expect } from 'vitest';

import { orderBetween } from '@/lib/order';

describe('orderBetween', () => {
  it('returns a starting order when both neighbors are null', () => {
    expect(orderBetween(null, null)).toBe(1);
  });

  it('appends after the previous neighbor when there is no next', () => {
    expect(orderBetween(2, null)).toBe(3);
  });

  it('prepends before the next neighbor when there is no previous', () => {
    expect(orderBetween(null, 4)).toBe(2);
  });

  it('places the card at the midpoint between both neighbors', () => {
    expect(orderBetween(2, 4)).toBe(3);
  });

  it('returns null when both neighbors share the same order', () => {
    expect(orderBetween(1, 1)).toBeNull();
  });

  it('returns null when the float gap collapses under midpoint', () => {
    const before = 1;
    let after = 2;
    for (let i = 0; i < 60; i += 1) {
      const mid = orderBetween(before, after);
      if (mid == null) {
        expect(mid).toBeNull();
        return;
      }
      after = mid;
    }
    expect.fail('expected midpoint precision to exhaust');
  });

  it('returns null when prepend would not stay strictly below after', () => {
    expect(orderBetween(null, Number.MIN_VALUE)).toBeNull();
  });

  it('returns null when append would not stay strictly above before', () => {
    expect(orderBetween(2 ** 53, null)).toBeNull();
  });

  it('returns null for non-finite append candidates', () => {
    expect(orderBetween(Number.POSITIVE_INFINITY, null)).toBeNull();
  });
});
