// tests/components/auth/mobileAuthBarOpacity.test.ts
//
// Tests for the phone auth bar fade against the landing hero.
//
// Tested:
// - No hero keeps the bar fully visible
// - The bar is hidden while the hero still covers the top of the viewport
// - Opacity rises over the first 96px of the hero leaving
// - The bar is fully visible once that distance has left
// - Reduced motion keeps the bar fully visible
//
// What is covered:
// - Present and absent hero, fade range, reduced motion
//
// Run with: pnpm test:run tests/components/auth/mobileAuthBarOpacity.test.ts
//
// SEE: src/components/auth/mobileAuthBarOpacity.ts

import { describe, it, expect } from 'vitest';

import {
  MOBILE_AUTH_BAR_FADE_DISTANCE_PX,
  mobileAuthBarOpacity,
} from '@/components/auth/mobileAuthBarOpacity';

describe('mobileAuthBarOpacity', () => {
  it('keeps the bar fully visible when there is no hero', () => {
    expect(mobileAuthBarOpacity(null, false)).toBe(1);
  });

  it('hides the bar while the hero still covers the top of the viewport', () => {
    expect(mobileAuthBarOpacity(0, false)).toBe(0);
    expect(mobileAuthBarOpacity(40, false)).toBe(0);
  });

  it('fades in over the first 96px of the hero leaving', () => {
    expect(mobileAuthBarOpacity(-MOBILE_AUTH_BAR_FADE_DISTANCE_PX / 2, false)).toBe(0.5);
  });

  it('shows the bar fully once that distance has left the viewport', () => {
    expect(mobileAuthBarOpacity(-MOBILE_AUTH_BAR_FADE_DISTANCE_PX, false)).toBe(1);
    expect(mobileAuthBarOpacity(-400, false)).toBe(1);
  });

  it('keeps the bar fully visible when motion is reduced', () => {
    expect(mobileAuthBarOpacity(0, true)).toBe(1);
    expect(mobileAuthBarOpacity(-MOBILE_AUTH_BAR_FADE_DISTANCE_PX / 2, true)).toBe(1);
  });
});
