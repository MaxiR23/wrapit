/** Pixels of travel as the scroll cue approaches the top for the bar to be fully opaque. */
export const MOBILE_AUTH_BAR_FADE_DISTANCE_PX = 96;

/** Identity of the landing-hero scroll cue the phone bar fade is anchored to. */
export const LANDING_HERO_CUE_ID = 'landing-hero-cue';

/**
 * Opacity of the fixed phone auth bar.
 *
 * Trigger: the landing-hero scroll cue (`#landing-hero-cue`) approaching the
 * top of the viewport. Fade starts when the cue's top edge is
 * `MOBILE_AUTH_BAR_FADE_DISTANCE_PX` (96px) from the top and completes when
 * that edge meets the top (`top <= 0`). CSS implements the same range as a
 * view timeline on the cue (`exit -96px` to `exit 0%`). No cue (sign-up and
 * the other auth screens) is treated as already gone, so the bar is fully
 * visible. Reduced motion skips the fade: the bar is simply there.
 */
export function mobileAuthBarOpacity(
  cueTop: number | null,
  reducedMotion: boolean,
  fadeDistance = MOBILE_AUTH_BAR_FADE_DISTANCE_PX,
): number {
  if (cueTop === null || reducedMotion) {
    return 1;
  }

  return Math.min(1, Math.max(0, (fadeDistance - cueTop) / fadeDistance));
}
