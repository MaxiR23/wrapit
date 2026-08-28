export const BOARD_COLUMN_WIDTH_PX = 330;
export const BOARD_COLUMN_GAP_PX = 12;
export const BOARD_CAROUSEL_STEP_PX = BOARD_COLUMN_WIDTH_PX + BOARD_COLUMN_GAP_PX;
export const BOARD_LONG_PRESS_MS = 420;
export const BOARD_LONG_PRESS_MOVE_PX = 8;

/**
 * How close the pointer must be to a rail edge before auto-scroll starts.
 * Conservative: 40px so aiming at the column body does not run the rail.
 * Tune after a real device pass.
 */
export const BOARD_DRAG_EDGE_PX = 40;

/**
 * Auto-scroll speed while the pointer is held in the edge band.
 * Conservative: 0.22px/ms ≈ 1.5s per 342px column.
 * Tune after a real device pass.
 */
export const BOARD_DRAG_EDGE_PX_PER_MS = 0.22;

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

/** -1 left, 1 right, 0 none. Uses BOARD_DRAG_EDGE_PX. */
export function dragEdgeScrollDirection(
  clientX: number,
  railLeft: number,
  railRight: number,
): -1 | 0 | 1 {
  if (clientX < railLeft + BOARD_DRAG_EDGE_PX) return -1;
  if (clientX > railRight - BOARD_DRAG_EDGE_PX) return 1;
  return 0;
}
