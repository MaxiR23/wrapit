// tests/lib/session.test.ts
//
// Tests for the request-memoized session helper used by the authenticated
// layout and pages.
//
// Tested:
// - One request validates the session once
// - A later request looks the session up again
//
// What is covered:
// - React.cache wrapping around auth.api.getSession. jsdom's client React
//   makes cache() a no-op, so this file installs a request-scoped stand-in.
//
// Run with: pnpm test:run tests/lib/session.test.ts
//
// SEE: src/lib/session.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRequestCache } from '../helpers/requestCache';

const getSessionFromAuth = vi.fn();

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const { cache } = await import('../helpers/requestCache');
  return { ...actual, cache };
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: getSessionFromAuth } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

const { getSession } = await import('@/lib/session');

describe('getSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRequestCache();
    getSessionFromAuth.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
  });

  it('resolves the session once within a request', async () => {
    const first = await getSession();
    const second = await getSession();

    expect(first).toBe(second);
    expect(getSessionFromAuth).toHaveBeenCalledTimes(1);
  });

  it('looks up the session again on a later request', async () => {
    await getSession();
    resetRequestCache();
    await getSession();

    expect(getSessionFromAuth).toHaveBeenCalledTimes(2);
  });
});
