// @vitest-environment node
// tests/lib/auth-skip-email-verification.test.ts
//
// Tests for the Better Auth instance when SKIP_EMAIL_VERIFICATION=true.
//
// Tested:
// - Warns at startup that email verification is disabled
// - Creates the account already verified
// - Does not send a verification email on sign-up
// - Signs in the new account without a verification step
//
// What is covered:
// - Flag on: warning, verified create, no verification mail, immediate sign-in
//
// Run with: pnpm test:run tests/lib/auth-skip-email-verification.test.ts
//
// SEE: src/lib/auth.ts, src/lib/skipEmailVerification.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-at-least-32-characters-long');
vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
vi.stubEnv('SKIP_EMAIL_VERIFICATION', 'true');

const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const sendVerificationEmail = vi.fn();
vi.mock('@/lib/email', () => ({
  sendResetPasswordEmail: vi.fn(),
  sendVerificationEmail,
}));

const { auth } = await import('@/lib/auth');
const { SKIP_EMAIL_VERIFICATION_WARNING } = await import('@/lib/skipEmailVerification');

const credentials = {
  email: 'ada@example.com',
  password: 'a-long-enough-password',
  name: 'Ada',
  username: 'ada',
};

describe('auth with SKIP_EMAIL_VERIFICATION=true', () => {
  beforeEach(() => {
    db.reset();
    sendVerificationEmail.mockReset();
  });

  it('warns at startup that email verification is disabled', () => {
    expect(warn).toHaveBeenCalledWith(SKIP_EMAIL_VERIFICATION_WARNING);
  });

  it('creates the account already verified', async () => {
    const result = await auth.api.signUpEmail({ body: credentials });

    expect(result.user.emailVerified).toBe(true);
    expect(db.user.rows[0]?.emailVerified).toBe(true);
  });

  it('does not send a verification email on sign-up', async () => {
    await auth.api.signUpEmail({ body: credentials });

    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('signs in the new account without a verification step', async () => {
    await auth.api.signUpEmail({ body: credentials });

    const result = await auth.api.signInEmail({
      body: { email: credentials.email, password: credentials.password },
    });

    expect(result.user.email).toBe(credentials.email);
  });
});
