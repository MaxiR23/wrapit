import { Resend } from 'resend';

import { renderTransactionalEmail } from '@/lib/emailLayout';
import { logInfo } from '@/lib/log';

const FROM = 'onboarding@resend.dev';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends the password-reset email. The body is the shared transactional layout
 * with a reset button and a plain-text alternative.
 */
export async function sendResetPasswordEmail(to: string, resetUrl: string): Promise<void> {
  const { html, text } = renderTransactionalEmail({
    preheader: 'Choose a new password for your wrapit account.',
    heading: 'Reset your password',
    body: 'Choose a new password for your wrapit account.',
    buttonLabel: 'Reset password',
    url: resetUrl,
    footer: 'If you did not request a password reset, you can ignore this email.',
  });

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your password',
    html,
    text,
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
 * Sends the email-verification message. The body is the shared transactional
 * layout with a verify button and a plain-text alternative.
 *
 * Resend `{ error }` is logged without the address or URL, then thrown so the
 * auth callback can swallow it. Swallowing keeps unknown and known addresses
 * indistinguishable; the thrown message is for server logs only and never
 * includes the URL (the token lives only in that URL).
 */
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const { html, text } = renderTransactionalEmail({
    preheader: 'Confirm this address to finish creating your wrapit account.',
    heading: 'Verify your email',
    body: 'Confirm this address to finish creating your wrapit account.',
    buttonLabel: 'Verify email',
    url: verifyUrl,
    footer:
      'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
  });

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your email',
    html,
    text,
  });

  if (error) {
    logInfo('email.verification_failed', { name: error.name, statusCode: error.statusCode });
    throw new Error(
      `Failed to send verification email: ${error.name} (${error.statusCode}): ${error.message}`,
    );
  }
}
