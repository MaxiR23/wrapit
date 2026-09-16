import { z } from 'zod';

/** Bounded opaque page cursor. Decode and order-binding live in `pagination.ts`. */
export const PAGE_CURSOR_MAX = 24_000;

export const pageCursorSchema = z.string().min(1).max(PAGE_CURSOR_MAX);
