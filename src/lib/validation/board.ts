import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';

export const boardSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
});

export type BoardInput = z.infer<typeof boardSchema>;

export type BoardFieldErrors = FieldErrors<BoardInput>;

/**
 * Validates the board fields and returns the first error for each invalid
 * field, ready to render next to its input. An empty object means valid input.
 */
export function validateBoard(input: BoardInput): BoardFieldErrors {
  const result = boardSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
