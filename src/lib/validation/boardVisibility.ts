import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';

export const boardVisibilitySchema = z.object({
  label: z.boolean(),
  code: z.boolean(),
  comments: z.boolean(),
  subtasks: z.boolean(),
  dueDate: z.boolean(),
  assignees: z.boolean(),
});

export type BoardVisibilityInput = z.infer<typeof boardVisibilitySchema>;

export type BoardVisibilityFieldErrors = FieldErrors<BoardVisibilityInput>;

/**
 * Validates the six board-visibility flags. An empty object means valid input.
 */
export function validateBoardVisibility(input: BoardVisibilityInput): BoardVisibilityFieldErrors {
  const result = boardVisibilitySchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}
