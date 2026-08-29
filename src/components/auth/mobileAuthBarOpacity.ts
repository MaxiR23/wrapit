/** Pixels of the hero that must leave the top of the viewport for the bar to be fully opaque. */
export const MOBILE_AUTH_BAR_FADE_DISTANCE_PX = 96;

/**
 * Opacity of the fixed phone auth bar.
 *
 * Trigger: `#landing-hero` scrolling up. Fade starts as soon as the hero's top
 * edge leaves the viewport (`top < 0`) and completes after
 * `MOBILE_AUTH_BAR_FADE_DISTANCE_PX` (96px) of that travel. CSS implements the
 * same range as `animation-range: 0px 96px` on the document scroll, which matches
 * this formula while the hero sits at the top of the page. No hero (sign-up
 * and the other auth screens) is treated as already gone, so the bar is fully
 * visible. Reduced motion skips the fade: the bar is simply there.
 */
export function mobileAuthBarOpacity(
  heroTop: number | null,
  reducedMotion: boolean,
  fadeDistance = MOBILE_AUTH_BAR_FADE_DISTANCE_PX,
): number {
  if (heroTop === null || reducedMotion) {
    return 1;
  }

  return Math.min(1, Math.max(0, -heroTop / fadeDistance));
}
