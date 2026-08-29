// tests/components/auth/easeDocumentScroll.test.ts
//
// Tests for distance-scaled eased document scrolling used by the phone Back control.
//
// Tested:
// - Duration scales with distance and is clamped
// - Reduced motion jumps to the target in one step
// - Motion eases from the current scrollY to the target
// - Each tween frame sets scroll instantly so CSS smooth does not wrap it
// - A second call cancels the in-flight tween
// - A user scroll during the animation stops it and leaves the viewport
//
// What is covered:
// - Duration bounds, reduced motion, easing, cancellation, user interrupt
//
// Run with: pnpm test:run tests/components/auth/easeDocumentScroll.test.ts
//
// SEE: src/components/auth/easeDocumentScroll.ts

import { afterEach, describe, it, expect, vi } from 'vitest';

import {
  easeDocumentScrollTo,
  easeInOutCubic,
  scrollDurationMs,
} from '@/components/auth/easeDocumentScroll';

describe('scrollDurationMs', () => {
  it('clamps short hops to the minimum duration', () => {
    expect(scrollDurationMs(0)).toBe(450);
    expect(scrollDurationMs(100)).toBe(450);
  });

  it('scales with distance between the clamps', () => {
    expect(scrollDurationMs(800)).toBe(640);
  });

  it('clamps long travel to the maximum duration', () => {
    expect(scrollDurationMs(3000)).toBe(1200);
  });
});

describe('easeInOutCubic', () => {
  it('starts, midpoints and finishes on the cubic ease-in-out curve', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });
});

describe('easeDocumentScrollTo', () => {
  afterEach(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('jumps to the target when motion is reduced', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    easeDocumentScrollTo(0, true);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('eases from the current scroll position to the target', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(800);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(performance, 'now').mockReturnValue(0);

    easeDocumentScrollTo(0, false);

    expect(frames).toHaveLength(1);
    frames[0](0);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 800, left: 0, behavior: 'instant' });

    frames[1](320);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 400, left: 0, behavior: 'instant' });

    frames[2](640);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('cancels an in-flight tween when called again', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(800);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    vi.spyOn(performance, 'now').mockReturnValue(0);

    easeDocumentScrollTo(0, false);
    easeDocumentScrollTo(0, false);

    expect(cancel).toHaveBeenCalledWith(1);
    expect(frames).toHaveLength(2);
  });

  it('stops the tween on user scroll and leaves the viewport where the user put it', () => {
    let y = 800;
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => y);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((arg?: unknown) => {
      if (typeof arg === 'object' && arg !== null && 'top' in arg) {
        y = Number((arg as ScrollToOptions).top);
      }
    });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    vi.spyOn(performance, 'now').mockReturnValue(0);

    easeDocumentScrollTo(0, false);
    frames[0](0);
    frames[1](320);
    expect(y).toBe(400);

    y = 520;
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));

    expect(cancel).toHaveBeenCalledWith(3);
    const callsAfterWheel = scrollTo.mock.calls.length;

    frames[2](640);

    expect(scrollTo.mock.calls.length).toBe(callsAfterWheel);
    expect(y).toBe(520);
  });
});
