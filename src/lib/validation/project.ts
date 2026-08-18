import { z } from 'zod';

import { columnSchema } from '@/lib/validation/column';
import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';

export const CREATE_PROJECT_STATUSES = ['NEW', 'IN_PROGRESS', 'PAUSED'] as const;

export const MAX_CREATE_PROJECT_COLUMNS = 8;

export const projectSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
  status: z
    .enum(CREATE_PROJECT_STATUSES, {
      error: 'Status must be New, In progress, or Paused',
    })
    .optional(),
  featured: z.boolean().optional(),
  columns: z
    .array(
      z.object({
        title: columnSchema.shape.title,
        order: z.number(),
      }),
    )
    .min(1, 'At least one column is required')
    .max(MAX_CREATE_PROJECT_COLUMNS, 'A project can have at most 8 columns')
    .optional(),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export type ProjectFieldErrors = FieldErrors<ProjectInput>;

/**
 * Validates the project fields and returns the first error for each invalid
 * field, ready to render next to its input. An empty object means valid input.
 */
export function validateProject(input: ProjectInput): ProjectFieldErrors {
  const result = projectSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
