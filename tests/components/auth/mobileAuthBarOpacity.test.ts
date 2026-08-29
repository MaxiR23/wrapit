// tests/components/auth/mobileAuthBarOpacity.test.ts
//
// Tests for the phone auth bar fade against the landing hero scroll cue.
//
// Tested:
// - No cue keeps the bar fully visible
// - The bar is hidden while the cue is still below the fade window
// - Opacity rises over the 96px as the cue approaches the top
// - The bar is fully visible once the cue has reached or passed the top
// - Reduced motion keeps the bar fully visible
//
// What is covered:
// - Present and absent cue, fade range, reduced motion
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
  it('keeps the bar fully visible when there is no cue', () => {
    expect(mobileAuthBarOpacity(null, false)).toBe(1);
  });

  it('hides the bar while the cue is still below the fade window', () => {
    expect(mobileAuthBarOpacity(MOBILE_AUTH_BAR_FADE_DISTANCE_PX, false)).toBe(0);
    expect(mobileAuthBarOpacity(400, false)).toBe(0);
  });

  it('fades in over the 96px as the cue approaches the top', () => {
    expect(mobileAuthBarOpacity(MOBILE_AUTH_BAR_FADE_DISTANCE_PX / 2, false)).toBe(0.5);
  });

  it('shows the bar fully once the cue has reached or passed the top', () => {
    expect(mobileAuthBarOpacity(0, false)).toBe(1);
    expect(mobileAuthBarOpacity(-40, false)).toBe(1);
  });

  it('keeps the bar fully visible when motion is reduced', () => {
    expect(mobileAuthBarOpacity(400, true)).toBe(1);
    expect(mobileAuthBarOpacity(MOBILE_AUTH_BAR_FADE_DISTANCE_PX / 2, true)).toBe(1);
  });
});
