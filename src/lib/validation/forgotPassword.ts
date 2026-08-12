import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export type ForgotPasswordFieldErrors = FieldErrors<ForgotPasswordInput>;

/**
 * Validates the forgot-password fields and returns the first error for each
 * invalid field, ready to render next to its input. An empty object means
 * valid input.
 *
 * Same schema as the forgot-password form (`zodResolver(forgotPasswordSchema)`):
 * do not add parallel rules elsewhere.
 */
export function validateForgotPassword(input: ForgotPasswordInput): ForgotPasswordFieldErrors {
  const result = forgotPasswordSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
