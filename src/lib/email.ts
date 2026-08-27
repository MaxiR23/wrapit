import { Resend } from 'resend';

import { logInfo } from '@/lib/log';

const FROM = 'onboarding@resend.dev';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends the password-reset email. The body is a plain HTML message that
 * includes the reset URL Better Auth (or the caller) built for this request.
 */
export async function sendResetPasswordEmail(to: string, resetUrl: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your password',
    html: `<p>Click the link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });

  // Resend resolves with { error } instead of throwing. Surface that so Better
  // Auth does not report success when the email was never sent. The message is
  // for server logs only; auth forms never render error.message.
  if (error) {
    throw new Error(
      `Failed to send reset password email: ${error.name} (${error.statusCode}): ${error.message}`,
    );
  }
}

/**
 * Sends the email-verification message. The body is a plain HTML message that
 * includes the verification URL Better Auth built for this request.
 *
 * Resend `{ error }` is logged without the address or URL, then thrown so the
 * auth callback can swallow it. Swallowing keeps unknown and known addresses
 * indistinguishable; the thrown message is for server logs only and never
 * includes the URL (the token lives only in that URL).
 */
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your email',
    html: `<p>Click the link to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });

  if (error) {
    logInfo('email.verification_failed', { name: error.name, statusCode: error.statusCode });
    throw new Error(
      `Failed to send verification email: ${error.name} (${error.statusCode}): ${error.message}`,
    );
  }
}
