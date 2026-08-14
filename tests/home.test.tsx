// tests/home.test.tsx
//
// Tests for the home page: landing hero for visitors, redirect for sessions.
//
// Tested:
// - Redirects a signed-in user to /boards
// - Renders the landing hero for a signed-out visitor
//
// What is covered:
// - Both session states
//
// Run with: pnpm test:run tests/home.test.tsx
//
// SEE: src/app/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  useRouter: () => ({ push: vi.fn() }),
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

  it('renders the landing hero for a signed-out visitor', async () => {
    getSession.mockResolvedValue(null);

    render(await Home());

    expect(redirect).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: "Your team's work, in columns." }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
