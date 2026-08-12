import { Resend } from 'resend';

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
