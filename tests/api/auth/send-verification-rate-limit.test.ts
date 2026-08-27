// @vitest-environment node
// tests/api/auth/send-verification-rate-limit.test.ts
//
// Tests for the production rate limit on POST /api/auth/send-verification-email.
//
// Tested:
// - The fourth request in a 60-second window from the same IP is 429
//
// What is covered:
// - Rate limit customRules for send-verification-email
//
// Run with: pnpm test:run tests/api/auth/send-verification-rate-limit.test.ts
//
// SEE: src/lib/auth.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../../helpers/prismaFake';

vi.stubEnv('NODE_ENV', 'production');
vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-at-least-32-characters-long');
vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/email', () => ({
  sendResetPasswordEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

const { POST } = await import('@/app/api/auth/[...all]/route');

const url = 'http://localhost:3000/api/auth/send-verification-email';

function sendRequest() {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
    },
    body: JSON.stringify({ email: 'ada@example.com', callbackURL: '/verify-email' }),
  });
}

describe('send-verification-email rate limit', () => {
  beforeEach(() => {
    db.reset();
  });

  it('refuses a fourth request in the window', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const response = await POST(sendRequest());
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 3).every((status) => status === 200)).toBe(true);
    expect(statuses[3]).toBe(429);
  });
});
