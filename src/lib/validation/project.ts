import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';

export const projectSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
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
