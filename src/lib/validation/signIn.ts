import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';

// Sign in deliberately does not reuse MIN_PASSWORD_LENGTH. Here only presence
// matters: the server decides whether the password is right, and an account
// created before a length change must still be able to sign in.
export const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type SignInInput = z.infer<typeof signInSchema>;

export type SignInFieldErrors = FieldErrors<SignInInput>;

/**
 * Validates the sign in fields and returns the first error for each invalid
 * field, ready to render next to its input. An empty object means valid input.
 *
 * These are input-shape errors only. Whether the credentials are correct is
 * never decided here, and never reported per field.
 */
export function validateSignIn(input: SignInInput): SignInFieldErrors {
  const result = signInSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
