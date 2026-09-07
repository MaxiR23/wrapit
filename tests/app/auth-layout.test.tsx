// tests/app/auth-layout.test.tsx
//
// Tests for the shared auth split layout.
//
// Tested:
// - Renders the page form in the layout slot
// - Shows a mobile brand bar without a Back control, hidden from 600px up
// - Does not render the landing hero
// - Wraps the form column in the light island
//
// What is covered:
// - Form slot, mobile brand bar without hero navigation, no hero, light island
//
// Run with: pnpm test:run tests/app/auth-layout.test.tsx
//
// SEE: src/app/(auth)/layout.tsx, src/components/auth/MobileAuthBar.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import AuthLayout from '@/app/(auth)/layout';

describe('AuthLayout', () => {
  it('renders the form children', () => {
    render(
      <AuthLayout>
        <p>Form slot</p>
      </AuthLayout>,
    );

    expect(screen.getByText('Form slot')).toBeInTheDocument();
  });

  it('shows a mobile-only brand bar without a Back control', () => {
    const { container } = render(
      <AuthLayout>
        <p>Form slot</p>
      </AuthLayout>,
    );

    const bar = container.querySelector('header');

    expect(bar).toHaveClass('fixed', 'safe-inset-x', 'safe-inset-t', 'auth-sm:hidden');
    expect(bar?.className).not.toMatch(/safe-area-inset/);
    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass('min-h-full');
  });

  it('does not render the landing hero', () => {
    const { container } = render(
      <AuthLayout>
        <p>Form slot</p>
      </AuthLayout>,
    );

    expect(container.querySelector('#landing-hero')).not.toBeInTheDocument();
    expect(container.querySelector('.brand-hero-surface')).not.toBeInTheDocument();
  });

  it('wraps the form column in the light island', () => {
    const { container } = render(
      <AuthLayout>
        <p>Form slot</p>
      </AuthLayout>,
    );

    expect(container.querySelector('.form-island')).toBeInTheDocument();
  });
});
