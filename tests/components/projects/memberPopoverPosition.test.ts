// tests/components/projects/memberPopoverPosition.test.ts
//
// Tests for clamping the member popover to the viewport.
//
// Tested:
// - Centers on the avatar when both sides have room
// - Shifts right when the first avatar would overflow the left edge
// - Shifts left when the last avatar would overflow the right edge
// - Pins to the inset when the viewport is narrower than the popover
//
// What is covered:
// - Centered, left-edge, right-edge, and undersized viewport
//
// Run with: pnpm test:run tests/components/projects/memberPopoverPosition.test.ts
//
// SEE: src/components/projects/memberPopoverPosition.ts

import { describe, it, expect } from 'vitest';

import {
  MEMBER_POPOVER_VIEWPORT_INSET_PX,
  memberPopoverOffsetX,
} from '@/components/projects/memberPopoverPosition';

const POPOVER = 170;
const AVATAR = 30;
const VIEWPORT = 360;
const INSET = MEMBER_POPOVER_VIEWPORT_INSET_PX;

function viewportLeft(avatarLeft: number, offsetX: number) {
  return avatarLeft + offsetX;
}

describe('memberPopoverOffsetX', () => {
  it('keeps the popover centered when the avatar has room on both sides', () => {
    const avatarLeft = 140;
    const offsetX = memberPopoverOffsetX({
      avatarLeft,
      avatarWidth: AVATAR,
      popoverWidth: POPOVER,
      viewportWidth: VIEWPORT,
    });

    expect(viewportLeft(avatarLeft, offsetX)).toBe(avatarLeft + AVATAR / 2 - POPOVER / 2);
  });

  it('clamps the first avatar so the popover stays inside the viewport', () => {
    const avatarLeft = 0;
    const offsetX = memberPopoverOffsetX({
      avatarLeft,
      avatarWidth: AVATAR,
      popoverWidth: POPOVER,
      viewportWidth: VIEWPORT,
    });
    const left = viewportLeft(avatarLeft, offsetX);

    expect(left).toBe(INSET);
    expect(left + POPOVER).toBeLessThanOrEqual(VIEWPORT - INSET);
  });

  it('clamps the last avatar so the popover stays inside the viewport', () => {
    const avatarLeft = VIEWPORT - AVATAR;
    const offsetX = memberPopoverOffsetX({
      avatarLeft,
      avatarWidth: AVATAR,
      popoverWidth: POPOVER,
      viewportWidth: VIEWPORT,
    });
    const left = viewportLeft(avatarLeft, offsetX);

    expect(left).toBeGreaterThanOrEqual(INSET);
    expect(left + POPOVER).toBe(VIEWPORT - INSET);
  });

  it('pins to the inset when the viewport is narrower than the popover', () => {
    const avatarLeft = 0;
    const offsetX = memberPopoverOffsetX({
      avatarLeft,
      avatarWidth: AVATAR,
      popoverWidth: POPOVER,
      viewportWidth: 120,
    });

    expect(viewportLeft(avatarLeft, offsetX)).toBe(INSET);
  });
});
