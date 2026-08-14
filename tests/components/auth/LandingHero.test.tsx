// tests/components/auth/LandingHero.test.tsx
//
// Tests for the landing hero on /.
//
// Tested:
// - Renders the brand headline, decorative mini-board and a Sign in link
// - The chevron control links to /sign-in
// - A downward wheel or ArrowDown navigates to /sign-in once
//
// What is covered:
// - Hero content, chevron link, scroll-down intent
//
// Run with: pnpm test:run tests/components/auth/LandingHero.test.tsx
//
// SEE: src/components/auth/LandingHero.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const { default: LandingHero } = await import('@/components/auth/LandingHero');

describe('LandingHero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the headline, an aria-hidden mini-board and a Sign in link', () => {
    render(<LandingHero />);

    expect(
      screen.getByRole('heading', { name: "Your team's work, in columns." }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('navigates to /sign-in on a downward wheel, only once', () => {
    render(<LandingHero />);

    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, cancelable: true }));
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, cancelable: true }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/sign-in');
  });

  it('navigates to /sign-in on ArrowDown', () => {
    render(<LandingHero />);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));

    expect(push).toHaveBeenCalledWith('/sign-in');
  });
});
