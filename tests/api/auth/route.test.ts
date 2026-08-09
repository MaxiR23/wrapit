// tests/api/auth/route.test.ts
//
// Tests for the Better Auth catch-all route handler.
//
// Tested:
// - Signs a user up through POST /api/auth/sign-up/email and sets a session cookie
// - Returns the session for a signed in user through GET /api/auth/get-session
// - Returns an error status for invalid credentials
// - Signs a user in through POST /api/auth/sign-in/email and sets a session cookie
// - Ends the session through POST /api/auth/sign-out
//
// What is covered:
// - Happy path, authenticated read, invalid input, the full session lifecycle
//   from sign in to sign out
//
// Run with: pnpm test:run tests/api/auth/route.test.ts
//
// SEE: app/api/auth/[...all]/route.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '@/tests/helpers/prismaFake';

vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-at-least-32-characters-long');
vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');

const db = createPrismaFake();
vi.mock('@/app/lib/prisma', () => ({ prisma: db }));

const { GET, POST } = await import('@/app/api/auth/[...all]/route');

const baseUrl = 'http://localhost:3000/api/auth';

const credentials = {
  email: 'ada@example.com',
  password: 'a-long-enough-password',
  name: 'Ada',
};

function jsonRequest(path: string, body: Record<string, string>) {
  return new Request(`${baseUrl}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function signUpRequest(body: Record<string, string>) {
  return jsonRequest('sign-up/email', body);
}

function signInRequest(body: Record<string, string>) {
  return jsonRequest('sign-in/email', body);
}

describe('auth route handler', () => {
  beforeEach(() => {
    db.reset();
  });

  it('signs a user up and sets a session cookie', async () => {
    const response = await POST(signUpRequest(credentials));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('better-auth.session_token');
    expect(db.user.rows).toHaveLength(1);
  });

  it('returns the session for a signed in user', async () => {
    const signUp = await POST(signUpRequest(credentials));
    const cookie = signUp.headers.get('set-cookie') ?? '';

    const response = await GET(new Request(`${baseUrl}/get-session`, { headers: { cookie } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { email: credentials.email },
    });
  });

  it('returns an error status when the password is too short', async () => {
    const response = await POST(signUpRequest({ ...credentials, password: 'short' }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(db.user.rows).toHaveLength(0);
  });

  it('signs a user in and sets a session cookie', async () => {
    await POST(signUpRequest(credentials));
    const { email, password } = credentials;

    const response = await POST(signInRequest({ email, password }));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('better-auth.session_token');
  });

  it('ends the session on sign out', async () => {
    const signUp = await POST(signUpRequest(credentials));
    const cookie = signUp.headers.get('set-cookie') ?? '';
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
