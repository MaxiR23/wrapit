// @vitest-environment node
// tests/api/auth/route.test.ts
//
// Tests for the Better Auth catch-all route handler.
//
// Tested:
// - Signs a user up through POST /api/auth/sign-up/email (with username) without a session cookie
// - Returns the session for a signed in verified user through GET /api/auth/get-session
// - Returns an error status for invalid credentials
// - Signs a verified user in through POST /api/auth/sign-in/email and sets a session cookie
// - Ends the session through POST /api/auth/sign-out
// - Verifies the emailed token through GET /api/auth/verify-email and sets a session
// - Treats a reused unexpired verification link as already verified
// - Answers an expired verification token with an error redirect
// - Answers send-verification-email the same for unknown addresses
//
// What is covered:
// - Happy path (including username persistence), authenticated read, invalid input,
//   the full session lifecycle from verify to sign out, verification token
//
// Run with: pnpm test:run tests/api/auth/route.test.ts
//
// SEE: src/app/api/auth/[...all]/route.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../../helpers/prismaFake';

vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-at-least-32-characters-long');
vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const sendVerificationEmail = vi.fn();
vi.mock('@/lib/email', () => ({
  sendResetPasswordEmail: vi.fn(),
  sendVerificationEmail,
}));

const { GET, POST } = await import('@/app/api/auth/[...all]/route');

const baseUrl = 'http://localhost:3000/api/auth';

const credentials = {
  email: 'ada@example.com',
  password: 'a-long-enough-password',
  name: 'Ada',
  username: 'ada',
};

function jsonRequest(path: string, body: Record<string, string>) {
  return new Request(`${baseUrl}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function signUpRequest(body: Record<string, string>) {
  return jsonRequest('sign-up/email', { ...body, callbackURL: '/verify-email' });
}

function signInRequest(body: Record<string, string>) {
  return jsonRequest('sign-in/email', body);
}

function markVerified(email: string) {
  const row = db.user.rows.find((user) => user.email === email);
  if (row) row.emailVerified = true;
}

function verificationTokenFromSend() {
  const url = String(sendVerificationEmail.mock.calls[0]?.[1]);
  return new URL(url).searchParams.get('token');
}

describe('auth route handler', () => {
  beforeEach(() => {
    db.reset();
    sendVerificationEmail.mockReset();
    sendVerificationEmail.mockResolvedValue(undefined);
  });

  it('signs a user up without a session cookie', async () => {
    const response = await POST(signUpRequest(credentials));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie') ?? '').not.toContain('better-auth.session_token');
    expect(db.user.rows).toHaveLength(1);
    expect(db.user.rows[0]?.username).toBe(credentials.username);
    expect(db.user.rows[0]?.emailVerified).toBe(false);
    expect(db.session.rows).toHaveLength(0);
  });

  it('returns the session for a signed in verified user', async () => {
    await POST(signUpRequest(credentials));
    markVerified(credentials.email);
    const { email, password } = credentials;
    const signIn = await POST(signInRequest({ email, password }));
    const cookie = signIn.headers.get('set-cookie') ?? '';

    const response = await GET(new Request(`${baseUrl}/get-session`, { headers: { cookie } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { email: credentials.email, username: credentials.username },
    });
  });

  it('returns an error status when the password is too short', async () => {
    const response = await POST(signUpRequest({ ...credentials, password: 'short' }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(db.user.rows).toHaveLength(0);
  });

  it('returns 403 when an unverified user signs in', async () => {
    await POST(signUpRequest(credentials));
    const { email, password } = credentials;

    const response = await POST(signInRequest({ email, password }));

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie') ?? '').not.toContain('better-auth.session_token');
  });

  it('signs a verified user in and sets a session cookie', async () => {
    await POST(signUpRequest(credentials));
    markVerified(credentials.email);
    const { email, password } = credentials;

    const response = await POST(signInRequest({ email, password }));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('better-auth.session_token');
  });

  it('verifies the emailed token, signs the user in, and marks the email verified', async () => {
    await POST(signUpRequest(credentials));
    const token = verificationTokenFromSend();
    expect(token).toBeTruthy();

    const response = await GET(
      new Request(
        `${baseUrl}/verify-email?token=${encodeURIComponent(token ?? '')}&callbackURL=${encodeURIComponent('/verify-email')}`,
      ),
    );

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(new URL(response.headers.get('location') ?? '', baseUrl).pathname).toBe('/verify-email');
    expect(response.headers.get('set-cookie')).toContain('better-auth.session_token');
    expect(db.user.rows[0]?.emailVerified).toBe(true);
  });

  it('treats a reused unexpired verification link as already verified', async () => {
    await POST(signUpRequest(credentials));
    const token = verificationTokenFromSend();
    expect(token).toBeTruthy();

    const first = await GET(
      new Request(
        `${baseUrl}/verify-email?token=${encodeURIComponent(token ?? '')}&callbackURL=${encodeURIComponent('/verify-email')}`,
      ),
    );
    expect(first.headers.get('set-cookie')).toContain('better-auth.session_token');

    const second = await GET(
      new Request(
        `${baseUrl}/verify-email?token=${encodeURIComponent(token ?? '')}&callbackURL=${encodeURIComponent('/verify-email')}`,
      ),
    );

    expect(second.status).toBeGreaterThanOrEqual(300);
    expect(second.status).toBeLessThan(400);
    expect(new URL(second.headers.get('location') ?? '', baseUrl).pathname).toBe('/verify-email');
    expect(new URL(second.headers.get('location') ?? '', baseUrl).search).not.toMatch(/error=/i);
    expect(second.headers.get('set-cookie') ?? '').not.toContain('better-auth.session_token');
    expect(db.user.rows[0]?.emailVerified).toBe(true);
  });

  it('redirects an expired verification token with an error and no session', async () => {
    await POST(signUpRequest(credentials));
    const token = verificationTokenFromSend();
    expect(token).toBeTruthy();

    vi.setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000));
    try {
      const response = await GET(
        new Request(
          `${baseUrl}/verify-email?token=${encodeURIComponent(token ?? '')}&callbackURL=${encodeURIComponent('/verify-email')}`,
        ),
      );

      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
      const location = response.headers.get('location') ?? '';
      expect(location).toContain('/verify-email');
      expect(location).toMatch(/error=/i);
      expect(location.toLowerCase()).not.toContain('token=');
      expect(response.headers.get('set-cookie') ?? '').not.toContain('better-auth.session_token');
      expect(db.user.rows[0]?.emailVerified).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('answers send-verification-email the same for an unknown address', async () => {
    const known = await POST(
      jsonRequest('send-verification-email', {
        email: 'nobody@example.com',
        callbackURL: '/verify-email',
      }),
    );
    const unknown = await POST(
      jsonRequest('send-verification-email', {
        email: 'also-nobody@example.com',
        callbackURL: '/verify-email',
      }),
    );

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    await expect(known.json()).resolves.toEqual({ status: true });
    await expect(unknown.json()).resolves.toEqual({ status: true });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('ends the session on sign out', async () => {
    await POST(signUpRequest(credentials));
    markVerified(credentials.email);
    const { email, password } = credentials;
    const signIn = await POST(signInRequest({ email, password }));
    const cookie = signIn.headers.get('set-cookie') ?? '';
    expect(db.session.rows).toHaveLength(1);

    const signOut = await POST(
      new Request(`${baseUrl}/sign-out`, { method: 'POST', headers: { cookie } }),
    );

    expect(signOut.status).toBe(200);
    expect(db.session.rows).toHaveLength(0);

    // The old cookie must no longer buy a session.
    const session = await GET(new Request(`${baseUrl}/get-session`, { headers: { cookie } }));
    await expect(session.text()).resolves.not.toContain(credentials.email);
  });
});
