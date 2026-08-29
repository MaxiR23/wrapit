// tests/components/auth/LandingHero.test.tsx
//
// Tests for the landing hero used on the sign-in mobile section.
//
// Tested:
// - Renders the brand headline, decorative mini-board and a Sign in control
// - The chevron control scrolls to the sign-in form island and is the fade cue
//
// What is covered:
// - Hero content, in-page chevron anchor
//
// Run with: pnpm test:run tests/components/auth/LandingHero.test.tsx
//
// SEE: src/components/auth/LandingHero.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import LandingHero from '@/components/auth/LandingHero';

describe('LandingHero', () => {
  it('renders the headline, an aria-hidden mini-board and a Sign in control', () => {
    render(<LandingHero />);

    expect(
      screen.getByRole('heading', { name: "Your team's work, in columns." }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '#sign-in-form');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('id', 'landing-hero-cue');
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
