import type { ZodError } from 'zod';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/**
 * Collects the first error message for each invalid field, keyed by field name
 * and ready to render next to its input. Shared by the form validators so every
 * form reports errors the same way.
 */
export function firstErrorPerField<T>(error: ZodError<T>): FieldErrors<T> {
  const errors: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof T;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}
