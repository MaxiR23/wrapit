// tests/lib/board.test.ts
//
// Tests for board carousel scroll math.
//
// Tested:
// - Index follows scrollLeft in 342px steps
// - Index is clamped to the column range
// - Programmatic jumps use index * 342
//
// What is covered:
// - Snap step, clamp, jump offset
//
// Run with: pnpm test:run tests/lib/board.test.ts
//
// SEE: src/lib/board.ts

import { describe, it, expect } from 'vitest';

import {
  BOARD_CAROUSEL_STEP_PX,
  carouselIndexFromScroll,
  carouselScrollLeftForIndex,
} from '@/lib/board';

describe('carouselIndexFromScroll', () => {
  it('maps scrollLeft to the nearest column in 342px steps', () => {
    expect(BOARD_CAROUSEL_STEP_PX).toBe(342);
    expect(carouselIndexFromScroll(0, 4)).toBe(0);
    expect(carouselIndexFromScroll(170, 4)).toBe(0);
    expect(carouselIndexFromScroll(171, 4)).toBe(1);
    expect(carouselIndexFromScroll(342, 4)).toBe(1);
    expect(carouselIndexFromScroll(684, 4)).toBe(2);
  });

  it('clamps to the first and last column', () => {
    expect(carouselIndexFromScroll(-20, 4)).toBe(0);
    expect(carouselIndexFromScroll(10_000, 4)).toBe(3);
    expect(carouselIndexFromScroll(0, 0)).toBe(0);
  });
});

describe('carouselScrollLeftForIndex', () => {
  it('returns index times the step', () => {
    expect(carouselScrollLeftForIndex(0)).toBe(0);
    expect(carouselScrollLeftForIndex(2)).toBe(684);
  });
});
