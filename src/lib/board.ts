export const BOARD_COLUMN_WIDTH_PX = 330;
export const BOARD_COLUMN_GAP_PX = 12;
export const BOARD_CAROUSEL_STEP_PX = BOARD_COLUMN_WIDTH_PX + BOARD_COLUMN_GAP_PX;
export const BOARD_LONG_PRESS_MS = 420;
export const BOARD_LONG_PRESS_MOVE_PX = 8;

/** Visible carousel column from rail scrollLeft. Clamped to 0..count-1. */
export function carouselIndexFromScroll(scrollLeft: number, columnCount: number): number {
  if (columnCount <= 0) return 0;
  const index = Math.round(scrollLeft / BOARD_CAROUSEL_STEP_PX);
  if (index <= 0) return 0;
  if (index > columnCount - 1) return columnCount - 1;
  return index;
}

export function carouselScrollLeftForIndex(index: number): number {
  return index * BOARD_CAROUSEL_STEP_PX;
}
