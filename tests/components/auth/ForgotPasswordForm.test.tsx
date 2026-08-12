// tests/components/auth/ForgotPasswordForm.test.tsx
//
// Tests for the forgot-password form.
//
// Tested:
// - Renders the email field
// - Requests a reset for the typed email and shows the confirmation message
// - Shows the same confirmation whether or not the email is registered
// - Rejects an invalid email format without calling Better Auth
// - Shows a generic message, not the server message, when the server fails
//
// What is covered:
// - Happy path, invalid input, non-enumeration, unexpected server error
//
// Run with: pnpm test:run tests/components/auth/ForgotPasswordForm.test.tsx
//
// SEE: src/components/auth/ForgotPasswordForm.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const requestPasswordReset = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { requestPasswordReset },
}));

const { default: ForgotPasswordForm } = await import('@/components/auth/ForgotPasswordForm');

const email = 'ada@example.com';

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
  });

  it('renders the email field', () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
  });

  it('requests a reset for the typed email and shows the confirmation message', async () => {
    render(<ForgotPasswordForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), email);
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(requestPasswordReset).toHaveBeenCalledWith({
      email,
      redirectTo: '/reset-password',
    });
    expect(
      await screen.findByText('If that email is registered, a reset link is on its way.'),
    ).toBeInTheDocument();
  });

  it('shows the same confirmation for any successful response', async () => {
    render(<ForgotPasswordForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(
      await screen.findByText('If that email is registered, a reset link is on its way.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('nobody@example.com')).not.toBeInTheDocument();
  });

  it('rejects an invalid email format without calling Better Auth', async () => {
    render(<ForgotPasswordForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'ada@');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('shows a generic message instead of the server message when the server fails', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    requestPasswordReset.mockResolvedValue({
      data: null,
      error: { message: leakyMessage, status: 500, statusText: 'Internal Server Error' },
    });
    render(<ForgotPasswordForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), email);
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.queryByText(leakyMessage)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('10.0.0.5');
  });
});
