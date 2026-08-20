import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';
import { idSchema } from '@/lib/validation/id';

export const columnSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
});

export type ColumnInput = z.infer<typeof columnSchema>;

export type ColumnFieldErrors = FieldErrors<ColumnInput>;

export const createColumnSchema = columnSchema.extend({
  projectId: idSchema,
});

export const deleteColumnSchema = z.object({
  columnId: idSchema,
});

/**
 * Validates the column fields and returns the first error for each invalid
 * field, ready to render next to its input. An empty object means valid input.
 */
export function validateColumn(input: ColumnInput): ColumnFieldErrors {
  const result = columnSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
