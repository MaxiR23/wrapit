import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';
import { MIN_PASSWORD_LENGTH } from '@/lib/validation/signUp';

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type ResetPasswordFieldErrors = FieldErrors<ResetPasswordInput>;

/**
 * Validates the reset-password fields and returns the first error for each
 * invalid field, ready to render next to its input. An empty object means
 * valid input.
 *
 * Same schema as the reset-password form (`zodResolver(resetPasswordSchema)`):
 * do not add parallel rules elsewhere.
 */
export function validateResetPassword(input: ResetPasswordInput): ResetPasswordFieldErrors {
  const result = resetPasswordSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
