// tests/lib/email.test.ts
//
// Tests for the Resend password-reset and verification email helpers.
//
// Tested:
// - Sends the reset email with the given address, URL, HTML layout, and plain text
// - Resolves when Resend returns no error
// - Throws with the Resend error details when Resend reports a failure
// - Sends the verification email with the given address, URL, HTML layout, and plain text
// - Throws without the URL and logs only Resend metadata when Resend fails
//
// What is covered:
// - Happy path, Resend { error } failure (Resend does not throw), token not in logs,
//   shared layout, plain-text alternative
//
// Run with: pnpm test:run tests/lib/email.test.ts
//
// SEE: src/lib/email.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const logInfo = vi.fn();
vi.mock('@/lib/log', () => ({ logInfo }));

const { sendResetPasswordEmail, sendVerificationEmail } = await import('@/lib/email');

const to = 'ada@example.com';
const resetUrl = 'http://localhost:3000/reset-password?token=a-reset-token';
const verifyUrl = 'http://localhost:3000/api/auth/verify-email?token=a-verify-token';

describe('sendResetPasswordEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the reset email with the given address and URL', async () => {
    send.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    await sendResetPasswordEmail(to, resetUrl);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'onboarding@resend.dev',
        to,
        subject: 'Reset your password',
        html: expect.stringContaining(resetUrl),
        text: expect.stringContaining(resetUrl),
      }),
    );
    const payload = send.mock.calls[0]?.[0] as { html: string; text: string };
    expect(payload.html).toContain('width="600"');
    expect(payload.html).toContain('v:roundrect');
    expect(payload.html).toContain('Reset password');
    expect(payload.text).toContain('Reset your password');
  });

  it('throws with the Resend error details when Resend reports a failure', async () => {
    send.mockResolvedValue({
      data: null,
      error: {
        name: 'invalid_api_key',
        message: 'API key is invalid',
        statusCode: 401,
      },
    });

    let thrown: Error | undefined;
    try {
      await sendResetPasswordEmail(to, resetUrl);
    } catch (error) {
      thrown = error as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown?.message).toMatch(/invalid_api_key.*API key is invalid/);
    expect(thrown?.message).not.toContain(resetUrl);
  });
});

describe('sendVerificationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the verification email with the given address and URL', async () => {
    send.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    await sendVerificationEmail(to, verifyUrl);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'onboarding@resend.dev',
        to,
        subject: 'Verify your email',
        html: expect.stringContaining(verifyUrl),
        text: expect.stringContaining(verifyUrl),
      }),
    );
    const payload = send.mock.calls[0]?.[0] as { html: string; text: string };
    expect(payload.html).toContain('width="600"');
    expect(payload.html).toContain('v:roundrect');
    expect(payload.html).toContain('Verify email');
    expect(payload.text).toContain('Verify your email');
  });

  it('throws without the URL and logs only Resend metadata when Resend fails', async () => {
    send.mockResolvedValue({
      data: null,
      error: {
        name: 'invalid_api_key',
        message: 'API key is invalid',
        statusCode: 401,
      },
    });

    await expect(sendVerificationEmail(to, verifyUrl)).rejects.toThrow(
      /invalid_api_key.*API key is invalid/,
    );

    let thrown: Error | undefined;
    try {
      await sendVerificationEmail(to, verifyUrl);
    } catch (error) {
      thrown = error as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown?.message).not.toContain(verifyUrl);
    expect(thrown?.message).not.toContain('a-verify-token');
    expect(logInfo).toHaveBeenCalledWith('email.verification_failed', {
      name: 'invalid_api_key',
      statusCode: 401,
    });
    expect(JSON.stringify(logInfo.mock.calls)).not.toContain(verifyUrl);
    expect(JSON.stringify(logInfo.mock.calls)).not.toContain(to);
  });
});
