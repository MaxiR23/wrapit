import type { PointerEvent as ReactPointerEvent } from 'react';

export const SWIPE_TAP_PX = 4;
export const SWIPE_REVEAL_PX = 8;
export const SWIPE_LIMIT_PX = 150;
export const SWIPE_COMMIT_PX = 96;
export const SWIPE_OPEN_PX = 40;
export const SWIPE_REST_PX = 104;

export function resolveSwipeEnd(dx: number): {
  restDx: number;
  commit: 'positive' | 'negative' | null;
} {
  if (dx > SWIPE_COMMIT_PX) return { restDx: 0, commit: 'positive' };
  if (dx < -SWIPE_COMMIT_PX) return { restDx: 0, commit: 'negative' };
  if (dx > SWIPE_OPEN_PX) return { restDx: SWIPE_REST_PX, commit: null };
  if (dx < -SWIPE_OPEN_PX) return { restDx: -SWIPE_REST_PX, commit: null };
  return { restDx: 0, commit: null };
}

export function startRowPointer(
  event: ReactPointerEvent<HTMLElement>,
  options: {
    swipeEnabled: boolean;
    selectionMode?: boolean;
    longPressMs?: number;
    longPressMovePx?: number;
    onLongPress?: () => void;
    onTap?: () => void;
    suppressClickOnTap?: boolean;
    onSuppressClick?: () => void;
    onSwipeChange: (dx: number) => void;
    onSwipeEnd: (dx: number) => void;
    onCommitPositive?: () => void;
    onCommitNegative?: () => void;
    canCommitPositive?: boolean;
    canCommitNegative?: boolean;
  },
) {
  const target = event.target as HTMLElement;
  if (target.closest('button, input')) return;

  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  let moved = false;
  let fired = false;
  let lastDx = 0;
  const origin = event.currentTarget;
  origin.setPointerCapture?.(pointerId);

  const timer =
    options.onLongPress && options.longPressMs != null
      ? window.setTimeout(() => {
          fired = true;
          if (navigator.vibrate) navigator.vibrate(10);
          options.onSuppressClick?.();
          options.onLongPress?.();
        }, options.longPressMs)
      : null;

  function onMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;
    if (
      options.longPressMovePx != null &&
      timer != null &&
      Math.hypot(deltaX, deltaY) > options.longPressMovePx
    ) {
      window.clearTimeout(timer);
    }
    if (Math.abs(deltaX) > SWIPE_TAP_PX || Math.abs(deltaY) > SWIPE_TAP_PX) {
      moved = true;
      if (timer != null) window.clearTimeout(timer);
    }
    if (!options.swipeEnabled || options.selectionMode || !moved) return;
    lastDx = Math.max(-SWIPE_LIMIT_PX, Math.min(SWIPE_LIMIT_PX, deltaX));
    options.onSwipeChange(lastDx);
  }

  function onUp(upEvent: PointerEvent) {
    if (upEvent.pointerId !== pointerId) return;
    teardown();
    if (fired) return;
    if (moved || options.suppressClickOnTap) options.onSuppressClick?.();
    if (!moved) {
      options.onTap?.();
      options.onSwipeEnd(0);
      return;
    }
    if (!options.swipeEnabled || options.selectionMode) {
      options.onSwipeEnd(0);
      return;
    }
    const end = resolveSwipeEnd(lastDx);
    if (end.commit === 'positive') {
      if (options.canCommitPositive !== false) options.onCommitPositive?.();
      options.onSwipeEnd(0);
      return;
    }
    if (end.commit === 'negative') {
      if (options.canCommitNegative !== false) options.onCommitNegative?.();
      options.onSwipeEnd(0);
      return;
    }
    options.onSwipeEnd(end.restDx);
  }

  function onCancel(cancelEvent: PointerEvent) {
    if (cancelEvent.pointerId !== pointerId) return;
    teardown();
    if (moved) options.onSuppressClick?.();
    options.onSwipeEnd(0);
  }

  function teardown() {
    if (timer != null) window.clearTimeout(timer);
    origin.releasePointerCapture?.(pointerId);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
}
