// tests/components/auth/ResetPasswordForm.test.tsx
//
// Tests for the reset-password form.
//
// Tested:
// - Shows a clear message when the token is missing
// - Shows a clear message when the token is marked invalid
// - Resets the password with the typed value and the token, then redirects to sign in
// - Rejects a confirmPassword that does not match without calling Better Auth
// - Shows a clear message when Better Auth rejects the token
// - Shows a generic message, not the server message, when the server fails
//
// What is covered:
// - Missing/invalid token, happy path, client validation, expired token, unexpected
//   server error
//
// Run with: pnpm test:run tests/components/auth/ResetPasswordForm.test.tsx
//
// SEE: src/components/auth/ResetPasswordForm.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const resetPassword = vi.fn();
const push = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { resetPassword },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const { default: ResetPasswordForm } = await import('@/components/auth/ResetPasswordForm');

const password = 'a-long-enough-password';
const token = 'a-valid-reset-token';

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm password'), password);
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
  return user;
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPassword.mockResolvedValue({ data: { status: true }, error: null });
  });

  it('shows a clear message when the token is missing', () => {
    render(<ResetPasswordForm />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This reset link is invalid or has expired.',
    );
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('shows a clear message when the token is marked invalid', () => {
    render(<ResetPasswordForm token={token} error="INVALID_TOKEN" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This reset link is invalid or has expired.',
    );
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('resets the password with the typed value and the token, then redirects to sign in', async () => {
    render(<ResetPasswordForm token={token} />);

    await fillAndSubmit();

    expect(resetPassword).toHaveBeenCalledWith({ newPassword: password, token });
    expect(push).toHaveBeenCalledWith('/sign-in');
  });

  it('rejects a confirmPassword that does not match without calling Better Auth', async () => {
    render(<ResetPasswordForm token={token} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Password'), password);
    await user.type(screen.getByLabelText('Confirm password'), 'a-different-password');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a clear message when Better Auth rejects the token', async () => {
    resetPassword.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Invalid token', status: 400 },
    });
    render(<ResetPasswordForm token={token} />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This reset link is invalid or has expired.',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a generic message instead of the server message when the server fails', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    resetPassword.mockResolvedValue({
      data: null,
      error: { message: leakyMessage, status: 500, statusText: 'Internal Server Error' },
    });
    render(<ResetPasswordForm token={token} />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.queryByText(leakyMessage)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
