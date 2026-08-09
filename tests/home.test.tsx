// tests/home.test.tsx
//
// Tests for the home page redirects.
//
// Tested:
// - Redirects a signed-in user to /boards
// - Redirects a signed-out visitor to /sign-in
//
// What is covered:
// - Both session states
//
// Run with: pnpm test:run tests/home.test.tsx
//
// SEE: src/app/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';

const getSession = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

const { default: Home } = await import('@/app/page');

describe('Home page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects a signed-in user to /boards', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-ada' } });

    await expect(Home()).rejects.toThrow('NEXT_REDIRECT:/boards');
    expect(redirect).toHaveBeenCalledWith('/boards');
  });

  it('redirects a signed-out visitor to /sign-in', async () => {
    getSession.mockResolvedValue(null);

    await expect(Home()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(redirect).toHaveBeenCalledWith('/sign-in');
  });
});
