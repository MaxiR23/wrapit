/** Gap kept between the popover and the viewport edges. */
export const MEMBER_POPOVER_VIEWPORT_INSET_PX = 8;

/** CSS `left` relative to the avatar so the popover stays in the viewport. */
export function memberPopoverOffsetX({
  avatarLeft,
  avatarWidth,
  popoverWidth,
  viewportWidth,
  inset = MEMBER_POPOVER_VIEWPORT_INSET_PX,
}: {
  avatarLeft: number;
  avatarWidth: number;
  popoverWidth: number;
  viewportWidth: number;
  inset?: number;
}): number {
  const centeredLeft = avatarLeft + avatarWidth / 2 - popoverWidth / 2;
  const minLeft = inset;
  const maxLeft = viewportWidth - popoverWidth - inset;
  const clampedLeft =
    maxLeft < minLeft ? minLeft : Math.min(Math.max(centeredLeft, minLeft), maxLeft);
  return clampedLeft - avatarLeft;
}
