const MS_PER_PX = 0.8;
const MIN_DURATION_MS = 450;
const MAX_DURATION_MS = 1200;
const INTERRUPT_EVENTS = ['wheel', 'touchstart', 'keydown'] as const;
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

let inFlightFrame = 0;
let listening = false;
let generation = 0;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function scrollDurationMs(distance: number): number {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.abs(distance) * MS_PER_PX));
}

function instantScrollTo(top: number) {
  // Override html { scroll-behavior: smooth } so each tween frame is a set,
  // not another UA smooth scroll.
  window.scrollTo({ top, left: 0, behavior: 'instant' });
}

function isEditableTarget(event: Event): boolean {
  const el = event.target;
  if (!(el instanceof HTMLElement)) {
    return false;
  }

  if (el.isContentEditable) {
    return true;
  }

  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function shouldInterrupt(event: Event): boolean {
  if (!(event instanceof KeyboardEvent)) {
    return true;
  }

  if (event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event)) {
    return false;
  }

  return SCROLL_KEYS.has(event.key);
}

function onInterrupt(event: Event) {
  if (!shouldInterrupt(event)) {
    return;
  }

  stopTween();
}

function startListening() {
  if (listening) {
    return;
  }

  listening = true;
  for (const type of INTERRUPT_EVENTS) {
    window.addEventListener(type, onInterrupt, { passive: true, capture: true });
  }
}

function stopListening() {
  if (!listening) {
    return;
  }

  listening = false;
  for (const type of INTERRUPT_EVENTS) {
    window.removeEventListener(type, onInterrupt, { capture: true });
  }
}

function stopTween() {
  generation += 1;
  cancelAnimationFrame(inFlightFrame);
  inFlightFrame = 0;
  stopListening();
}

/** Eased document scroll whose duration scales with distance. Reduced motion jumps. */
export function easeDocumentScrollTo(top: number, reducedMotion: boolean): void {
  stopTween();

  if (reducedMotion) {
    instantScrollTo(top);
    return;
  }

  const start = window.scrollY;
  const distance = top - start;
  if (distance === 0) {
    return;
  }

  const duration = scrollDurationMs(distance);
  const startTime = performance.now();
  const thisGeneration = generation;
  startListening();

  const step = (now: number) => {
    if (thisGeneration !== generation) {
      return;
    }

    const t = Math.min(1, (now - startTime) / duration);
    instantScrollTo(start + distance * easeInOutCubic(t));
    if (t < 1) {
      inFlightFrame = requestAnimationFrame(step);
    } else {
      inFlightFrame = 0;
      stopListening();
    }
  };

  inFlightFrame = requestAnimationFrame(step);
}
