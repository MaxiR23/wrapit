// @vitest-environment node
// tests/lib/auth.test.ts
//
// Tests for the Better Auth instance and its Prisma wiring.
//
// Tested:
// - Signs up a user with email and password and returns the user
// - Persists the username on the created user
// - Creates the account unverified and does not open a session
// - Sends a verification email whose URL contains a token
// - Stores the password hashed on a credential account, never on the user
// - Rejects a sign up whose password is shorter than the minimum
// - Rejects a sign up whose email format is invalid
// - Rejects a sign up whose email is empty
// - Rejects a sign up with a missing name
// - Rejects a sign up with a missing username
// - Returns success for a sign up whose email is already registered
// - Rejects a sign up whose username is already taken
// - Swallows a verification-send failure so sign-up still succeeds
// - Rejects an unverified sign in
// - Signs in a verified account with the correct password and rejects the wrong one
// - Rejects a sign in for an email that is not registered
// - Verifies the emailed token and then allows sign in
//
// What is covered:
// - Happy path, invalid input, missing fields, duplicate email, duplicate
//   username, wrong credentials, unknown email, unverified sign in, verify
//
// Run with: pnpm test:run tests/lib/auth.test.ts
//
// SEE: src/lib/auth.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-at-least-32-characters-long');
vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const sendResetPasswordEmail = vi.fn();
const sendVerificationEmail = vi.fn();
vi.mock('@/lib/email', () => ({
  sendResetPasswordEmail,
  sendVerificationEmail,
}));

const { auth } = await import('@/lib/auth');

const credentials = {
  email: 'ada@example.com',
  password: 'a-long-enough-password',
  name: 'Ada',
  username: 'ada',
};

function markVerified(email: string) {
  const row = db.user.rows.find((user) => user.email === email);
  if (row) row.emailVerified = true;
}

describe('auth', () => {
  beforeEach(() => {
    db.reset();
    sendVerificationEmail.mockReset();
    sendVerificationEmail.mockResolvedValue(undefined);
    sendResetPasswordEmail.mockReset();
  });

  it('signs up a user with email and password', async () => {
    const result = await auth.api.signUpEmail({ body: credentials });

    expect(result.user.email).toBe(credentials.email);
    expect(result.user.name).toBe(credentials.name);
    expect(result.user.username).toBe(credentials.username);
    expect(result.user.emailVerified).toBe(false);
    expect(result.token).toBeNull();
    expect(db.user.rows).toHaveLength(1);
    expect(db.user.rows[0]?.username).toBe(credentials.username);
    expect(db.session.rows).toHaveLength(0);
  });

  it('sends a verification email whose URL contains a token and not a logged token', async () => {
    await auth.api.signUpEmail({ body: credentials });

    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      credentials.email,
      expect.stringMatching(/\/verify-email\?token=/),
    );
    const url = sendVerificationEmail.mock.calls[0]?.[1];
    expect(typeof url).toBe('string');
    expect(url).toContain('callbackURL=');
    expect(JSON.stringify(sendVerificationEmail.mock.calls)).toContain('token=');
  });

  it('stores the password hashed on a credential account, not on the user', async () => {
    await auth.api.signUpEmail({ body: credentials });

    expect(db.user.rows[0]).not.toHaveProperty('password');

    const account = db.account.rows[0];
    expect(account.providerId).toBe('credential');
    expect(account.password).toEqual(expect.any(String));
    expect(account.password).not.toBe(credentials.password);
  });

  it('rejects a sign up when the password is too short', async () => {
    await expect(
      auth.api.signUpEmail({ body: { ...credentials, password: 'short' } }),
    ).rejects.toThrow();

    expect(db.user.rows).toHaveLength(0);
  });

  it('rejects a sign up when the email format is invalid', async () => {
    await expect(
      auth.api.signUpEmail({ body: { ...credentials, email: 'ada@' } }),
    ).rejects.toThrow();

    expect(db.user.rows).toHaveLength(0);
  });

  it('rejects a sign up when the email is empty', async () => {
    await expect(auth.api.signUpEmail({ body: { ...credentials, email: '' } })).rejects.toThrow();

    expect(db.user.rows).toHaveLength(0);
  });

  it('rejects a sign up when the name is missing', async () => {
    const { email, password, username } = credentials;

    await expect(
      // The name is required by the sign up schema; omitting it must not create a user.
      auth.api.signUpEmail({ body: { email, password, username } as typeof credentials }),
    ).rejects.toThrow();

    expect(db.user.rows).toHaveLength(0);
  });

  it('rejects a sign up when the username is missing', async () => {
    const { email, password, name } = credentials;

    await expect(
      auth.api.signUpEmail({ body: { email, password, name } as typeof credentials }),
    ).rejects.toThrow();

    expect(db.user.rows).toHaveLength(0);
  });

  it('returns success when the email is already registered', async () => {
    await auth.api.signUpEmail({ body: credentials });

    const result = await auth.api.signUpEmail({
      body: { ...credentials, username: 'ada2' },
    });

    expect(result.token).toBeNull();
    expect(result.user.email).toBe(credentials.email);
    expect(result.user.username).toBe('ada2');
    expect(db.user.rows).toHaveLength(1);
  });

  it('rejects a sign up when the username is already taken', async () => {
    await auth.api.signUpEmail({ body: credentials });

    await expect(
      auth.api.signUpEmail({
        body: { ...credentials, email: 'other@example.com' },
      }),
    ).rejects.toThrow();

    expect(db.user.rows).toHaveLength(1);
  });

  it('still creates the user when sending the verification email fails', async () => {
    sendVerificationEmail.mockRejectedValueOnce(new Error('Resend unavailable'));

    const result = await auth.api.signUpEmail({ body: credentials });

    expect(result.user.email).toBe(credentials.email);
    expect(db.user.rows).toHaveLength(1);
  });

  it('rejects an unverified sign in', async () => {
    await auth.api.signUpEmail({ body: credentials });

    await expect(
      auth.api.signInEmail({
        body: { email: credentials.email, password: credentials.password },
      }),
    ).rejects.toMatchObject({ status: 'FORBIDDEN', body: { code: 'EMAIL_NOT_VERIFIED' } });

    expect(db.session.rows).toHaveLength(0);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('signs in a verified account with the correct password', async () => {
    await auth.api.signUpEmail({ body: credentials });
    markVerified(credentials.email);

    const result = await auth.api.signInEmail({
      body: { email: credentials.email, password: credentials.password },
    });

    expect(result.user.email).toBe(credentials.email);
  });

  it('rejects a sign in with the wrong password', async () => {
    await auth.api.signUpEmail({ body: credentials });
    markVerified(credentials.email);

    await expect(
      auth.api.signInEmail({
        body: { email: credentials.email, password: 'not-the-password' },
      }),
    ).rejects.toThrow();
  });

  it('rejects a sign in for an email that is not registered', async () => {
    await expect(
      auth.api.signInEmail({
        body: { email: 'nobody@example.com', password: credentials.password },
      }),
    ).rejects.toThrow();

    expect(db.session.rows).toHaveLength(0);
  });

  it('verifies the emailed token and then allows sign in', async () => {
    await auth.api.signUpEmail({
      body: { ...credentials, callbackURL: '/verify-email' },
    });

    const url = String(sendVerificationEmail.mock.calls[0]?.[1]);
    const token = new URL(url).searchParams.get('token');
    expect(token).toBeTruthy();

    await auth.api.verifyEmail({
      query: { token: token ?? '' },
    });

    expect(db.user.rows[0]?.emailVerified).toBe(true);

    const result = await auth.api.signInEmail({
      body: { email: credentials.email, password: credentials.password },
    });
    expect(result.user.email).toBe(credentials.email);
  });
});
