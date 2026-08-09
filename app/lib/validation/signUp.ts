import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/app/lib/validation/fieldErrors';

// Shared by the sign up form and the Better Auth config, so the rule the user
// sees in the browser is the rule the server enforces.
export const MIN_PASSWORD_LENGTH = 8;

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.email('Enter a valid email address'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export type SignUpFieldErrors = FieldErrors<SignUpInput>;

/**
 * Validates the sign up fields and returns the first error for each invalid
 * field, ready to render next to its input. An empty object means valid input.
 */
export function validateSignUp(input: SignUpInput): SignUpFieldErrors {
  const result = signUpSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
