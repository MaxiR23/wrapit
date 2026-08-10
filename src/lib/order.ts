/**
 * Places a card between optional neighbors on a Float `order` scale without
 * renumbering siblings. Returns `null` when the gap is too small for a distinct
 * value (caller should renumber the column), including exhausted prepend/append
 * extremes and non-finite results.
 */
export function orderBetween(before: number | null, after: number | null): number | null {
  if (before == null && after == null) return 1;

  if (before == null) {
    const candidate = after! / 2;
    // Must stay strictly below `after` and above 0 (underflow → 0 is exhausted).
    if (!Number.isFinite(candidate) || !(candidate > 0 && candidate < after!)) return null;
    return candidate;
  }

  if (after == null) {
    const candidate = before + 1;
    if (!Number.isFinite(candidate) || !(candidate > before)) return null;
    return candidate;
  }

  const mid = (before + after) / 2;
  if (!Number.isFinite(mid) || !(mid > before && mid < after)) return null;
  return mid;
}
