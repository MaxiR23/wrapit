export const SAFE_FIXED_ROOT_ID = 'safe-fixed-root';

export function getSafeFixedRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(SAFE_FIXED_ROOT_ID);
}
