// tests/lib/auth.test.ts
//
// Tests for the Better Auth instance and its Prisma wiring.
//
// Tested:
// - Signs up a user with email and password and returns the user
// - Stores the password hashed on a credential account, never on the user
// - Rejects a sign up whose password is shorter than the minimum
// - Rejects a sign up whose email format is invalid
// - Rejects a sign up whose email is empty
// - Rejects a sign up with a missing name
// - Rejects a sign up for an email that is already registered
// - Signs in with the correct password and rejects the wrong one
// - Rejects a sign in for an email that is not registered
//
// What is covered:
// - Happy path, invalid input, missing fields, duplicate email, wrong
//   credentials, unknown email
//
// Run with: pnpm test:run tests/lib/auth.test.ts
//
// SEE: app/lib/auth.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '@/tests/helpers/prismaFake';

vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-at-least-32-characters-long');
vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');

const db = createPrismaFake();
vi.mock('@/app/lib/prisma', () => ({ prisma: db }));

const { auth } = await import('@/app/lib/auth');

const credentials = {
  email: 'ada@example.com',
  password: 'a-long-enough-password',
  name: 'Ada',
};

describe('auth', () => {
  beforeEach(() => {
    db.reset();
  });

  it('signs up a user with email and password', async () => {
    const result = await auth.api.signUpEmail({ body: credentials });

    expect(result.user.email).toBe(credentials.email);
    expect(result.user.name).toBe(credentials.name);
    expect(db.user.rows).toHaveLength(1);
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
    const { email, password } = credentials;

    await expect(
      // The name is required by the sign up schema; omitting it must not create a user.
      auth.api.signUpEmail({ body: { email, password } as typeof credentials }),
    ).rejects.toThrow();

    expect(db.user.rows).toHaveLength(0);
  });

  it('rejects a sign up when the email is already registered', async () => {
    await auth.api.signUpEmail({ body: credentials });

    await expect(auth.api.signUpEmail({ body: credentials })).rejects.toThrow();

    expect(db.user.rows).toHaveLength(1);
  });

  it('signs in with the correct password', async () => {
    await auth.api.signUpEmail({ body: credentials });

    const result = await auth.api.signInEmail({
      body: { email: credentials.email, password: credentials.password },
    });

    expect(result.user.email).toBe(credentials.email);
  });

  it('rejects a sign in with the wrong password', async () => {
    await auth.api.signUpEmail({ body: credentials });

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
});
