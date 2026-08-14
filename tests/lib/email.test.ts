// tests/lib/email.test.ts
//
// Tests for the Resend password-reset email helper.
//
// Tested:
// - Sends the reset email with the given address and URL
// - Resolves when Resend returns no error
// - Throws with the Resend error details when Resend reports a failure
//
// What is covered:
// - Happy path, Resend { error } failure (Resend does not throw)
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

const { sendResetPasswordEmail } = await import('@/lib/email');

const to = 'ada@example.com';
const resetUrl = 'http://localhost:3000/reset-password?token=a-reset-token';

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
        html: expect.stringContaining(resetUrl),
      }),
    );
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

    await expect(sendResetPasswordEmail(to, resetUrl)).rejects.toThrow(
      /invalid_api_key.*API key is invalid/,
    );
  });
});
