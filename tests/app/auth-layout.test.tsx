// tests/app/auth-layout.test.tsx
//
// Tests for the shared auth split layout.
//
// Tested:
// - Renders the page form in the layout slot
// - Shows a mobile back link to / whose wrapper is hidden from 600px up
// - Wraps the form column in the light island
//
// What is covered:
// - Form slot, mobile back affordance, light island
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

  it('shows a mobile-only back link to the landing page', () => {
    render(
      <AuthLayout>
        <p>Form slot</p>
      </AuthLayout>,
    );

    const back = screen.getByRole('link', { name: 'Back' });

    expect(back).toHaveAttribute('href', '/');
    expect(back.closest('header')).toHaveClass('fixed', 'auth-sm:hidden');
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
