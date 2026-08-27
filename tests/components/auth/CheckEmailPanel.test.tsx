// tests/components/auth/CheckEmailPanel.test.tsx
//
// Tests for the check-email waiting panel.
//
// Tested:
// - Renders the waiting copy and the email field
// - Requests a new link for the typed email and shows the confirmation
// - Shows the same confirmation for any successful response
// - Rejects an invalid email format without calling Better Auth
// - Shows the rate-limit message on 429
// - Shows a generic message, not the server message, when the server fails
//
// What is covered:
// - Happy path, invalid input, non-enumeration, rate limit, unexpected server error
//
// Run with: pnpm test:run tests/components/auth/CheckEmailPanel.test.tsx
//
// SEE: src/components/auth/CheckEmailPanel.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const sendVerificationEmail = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { sendVerificationEmail },
}));

const { default: CheckEmailPanel } = await import('@/components/auth/CheckEmailPanel');

const email = 'ada@example.com';

describe('CheckEmailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendVerificationEmail.mockResolvedValue({ data: { status: true }, error: null });
  });

  it('renders the waiting copy and the email field', () => {
    render(<CheckEmailPanel />);

    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send a new link' })).toBeInTheDocument();
  });

  it('prefills the email when one is provided', () => {
    render(<CheckEmailPanel email={email} />);

    expect(screen.getByLabelText('Email')).toHaveValue(email);
  });

  it('requests a new link and shows the confirmation message', async () => {
    render(<CheckEmailPanel />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), email);
    await user.click(screen.getByRole('button', { name: 'Send a new link' }));

    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email,
      callbackURL: '/verify-email',
    });
    expect(
      await screen.findByText(
        'If that email is registered and still needs verifying, a new link is on its way.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the same confirmation for any successful response', async () => {
    render(<CheckEmailPanel />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: 'Send a new link' }));

    expect(
      await screen.findByText(
        'If that email is registered and still needs verifying, a new link is on its way.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('nobody@example.com')).not.toBeInTheDocument();
  });

  it('rejects an invalid email format without calling Better Auth', async () => {
    render(<CheckEmailPanel />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'ada@');
    await user.click(screen.getByRole('button', { name: 'Send a new link' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('shows the rate-limit message on 429', async () => {
    sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { status: 429, message: 'Too many requests', statusText: 'Too Many Requests' },
    });
    render(<CheckEmailPanel />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), email);
    await user.click(screen.getByRole('button', { name: 'Send a new link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please wait before requesting another email.',
    );
  });

  it('shows a generic message instead of the server message when the server fails', async () => {
    const leakyMessage = 'token=a-verify-token leaked from the mailer';
    sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { message: leakyMessage, status: 500, statusText: 'Internal Server Error' },
    });
    render(<CheckEmailPanel />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), email);
    await user.click(screen.getByRole('button', { name: 'Send a new link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.queryByText(leakyMessage)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('a-verify-token');
  });
});
