/**
 * Email verification is skipped only when SKIP_EMAIL_VERIFICATION is the exact
 * string "true". Absent or any other value leaves verification on, so a typo
 * or a forgotten variable is the safe direction. Not tied to NODE_ENV.
 */
export function isSkipEmailVerificationEnabled(
  value: string | undefined = process.env.SKIP_EMAIL_VERIFICATION,
): boolean {
  return value === 'true';
}

export const SKIP_EMAIL_VERIFICATION_WARNING =
  'Email verification is disabled (SKIP_EMAIL_VERIFICATION=true)';
