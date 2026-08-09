// tests/api/auth/route.test.ts
//
// Tests for the Better Auth catch-all route handler.
//
// Tested:
// - Signs a user up through POST /api/auth/sign-up/email and sets a session cookie
// - Returns the session for a signed in user through GET /api/auth/get-session
// - Returns an error status for invalid credentials
//
// What is covered:
// - Happy path, authenticated read, invalid input
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

function signUpRequest(body: Record<string, string>) {
  return new Request(`${baseUrl}/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
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
});
