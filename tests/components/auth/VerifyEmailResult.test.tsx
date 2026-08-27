// tests/components/auth/VerifyEmailResult.test.tsx
//
// Tests for the verification result panel.
//
// Tested:
// - Shows the invalid-or-expired message for any error code
// - Does not render the error code or a token
// - Shows the already-verified message when there is no error
//
// What is covered:
// - Expired/invalid link, already-used link, no leak of server details
//
// Run with: pnpm test:run tests/components/auth/VerifyEmailResult.test.tsx
//
// SEE: src/components/auth/VerifyEmailResult.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import VerifyEmailResult from '@/components/auth/VerifyEmailResult';

describe('VerifyEmailResult', () => {
  it('shows the invalid-or-expired message for TOKEN_EXPIRED', () => {
    render(<VerifyEmailResult error="TOKEN_EXPIRED" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This verification link is invalid or has expired.',
    );
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/check-email',
    );
    expect(screen.queryByText('TOKEN_EXPIRED')).not.toBeInTheDocument();
  });

  it('shows the same message for INVALID_TOKEN and USER_NOT_FOUND', () => {
    const { rerender } = render(<VerifyEmailResult error="INVALID_TOKEN" />);
    const invalid = screen.getByRole('alert').textContent;

    rerender(<VerifyEmailResult error="USER_NOT_FOUND" />);
    expect(screen.getByRole('alert')).toHaveTextContent(invalid ?? '');
    expect(screen.queryByText('USER_NOT_FOUND')).not.toBeInTheDocument();
  });

  it('shows the already-verified message when there is no error', () => {
    render(<VerifyEmailResult />);

    expect(
      screen.getByText('This email is already verified. Sign in to continue.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
