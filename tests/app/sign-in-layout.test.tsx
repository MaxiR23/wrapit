// tests/app/sign-in-layout.test.tsx
//
// Tests for the sign-in layout: mobile hero above the form, split from auth-sm up.
//
// Tested:
// - Renders the page form in the layout slot once
// - Shows the landing hero only below auth-sm
// - Keeps the brand panel for the existing split
// - Wraps the form column in the light island with an in-page target
//
// What is covered:
// - Single form slot, CSS-only mobile hero, brand panel, light island
//
// Run with: pnpm test:run tests/app/sign-in-layout.test.tsx
//
// SEE: src/app/(sign-in)/sign-in/layout.tsx, src/components/auth/LandingHero.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import SignInLayout from '@/app/(sign-in)/sign-in/layout';

describe('SignInLayout', () => {
  it('renders the form children once', () => {
    render(
      <SignInLayout>
        <p>Form slot</p>
      </SignInLayout>,
    );

    expect(screen.getByText('Form slot')).toBeInTheDocument();
  });

  it('shows the landing hero only below auth-sm', () => {
    const { container } = render(
      <SignInLayout>
        <p>Form slot</p>
      </SignInLayout>,
    );

    const hero = container.querySelector('.brand-hero-surface');

    expect(hero).toBeInTheDocument();
    expect(hero?.parentElement).toHaveClass('auth-sm:hidden');
    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('keeps the brand panel for the split layout', () => {
    const { container } = render(
      <SignInLayout>
        <p>Form slot</p>
      </SignInLayout>,
    );

    expect(container.querySelector('.brand-panel-surface')).toBeInTheDocument();
  });

  it('wraps the form column in the light island with an in-page target', () => {
    const { container } = render(
      <SignInLayout>
        <p>Form slot</p>
      </SignInLayout>,
    );

    const island = container.querySelector('.form-island');

    expect(island).toBeInTheDocument();
    expect(island).toHaveAttribute('id', 'sign-in-form');
  });
});
