import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';

export const viewModeSchema = z.object({
  viewMode: z.enum(['grid', 'list']),
});

export type ViewModeInput = z.infer<typeof viewModeSchema>;

export type ViewModeFieldErrors = FieldErrors<ViewModeInput>;

/**
 * Validates the view-mode field and returns the first error for each invalid
 * field. An empty object means valid input.
 */
export function validateViewMode(input: ViewModeInput): ViewModeFieldErrors {
  const result = viewModeSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
