// tests/components/auth/SignInForm.test.tsx
//
// Tests for the sign in form.
//
// Tested:
// - Renders the email and password fields, a forgot-password link, and no name field
// - Signs the user in with the typed values and redirects to the app
// - Shows a generic message when the password is wrong
// - Shows the same message for an email that is not registered
// - Shows the same message even for a USER_NOT_FOUND response
// - Rejects an invalid email format without calling Better Auth
// - Rejects an empty password without calling Better Auth
// - Shows a generic message, not the server message, when the server fails
// - Clears a stale form-level API error when resubmitting with invalid input
//
// What is covered:
// - Happy path, invalid input, wrong credentials, unknown email, unexpected
//   server error, stale root error on invalid resubmit, and the rule that a
//   failed sign in never reveals whether an email is registered
//
// Run with: pnpm test:run tests/components/auth/SignInForm.test.tsx
//
// SEE: src/components/auth/SignInForm.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInEmail = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { signIn: { email: signInEmail } },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const { default: SignInForm } = await import('@/components/auth/SignInForm');

const credentials = {
  email: 'ada@example.com',
  password: 'a-long-enough-password',
};

// What Better Auth answers for a wrong password and for an email that was never
// registered: the very same 401. See node_modules/better-auth sign-in route.
const invalidCredentials = {
  data: null,
  error: {
    code: 'INVALID_EMAIL_OR_PASSWORD',
    message: 'Invalid email or password',
    status: 401,
    statusText: 'Unauthorized',
  },
};

async function fillForm(fields: Partial<typeof credentials> = {}) {
  const values = { ...credentials, ...fields };
  const user = userEvent.setup();

  if (values.email) await user.type(screen.getByLabelText('Email'), values.email);
  if (values.password) await user.type(screen.getByLabelText('Password'), values.password);

  return user;
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

/** Renders a fresh form, submits it, and returns the text of the alert shown. */
async function alertTextFor(response: unknown, fields: Partial<typeof credentials> = {}) {
  signInEmail.mockResolvedValue(response);

  const { unmount } = render(<SignInForm />);
  const user = await fillForm(fields);
  await submit(user);
  const text = (await screen.findByRole('alert')).textContent;
  unmount();

  return text;
}

describe('SignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInEmail.mockResolvedValue({ data: { user: { email: credentials.email } }, error: null });
  });

  it('renders the email and password fields and no name field', () => {
    render(<SignInForm />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    const forgotLinks = screen.getAllByRole('link', { name: 'Forgot password?' });
    expect(forgotLinks).toHaveLength(2);
    for (const link of forgotLinks) {
      expect(link).toHaveAttribute('href', '/forgot-password');
    }
  });

  it('signs the user in with the typed values and redirects to the app', async () => {
    render(<SignInForm />);

    const user = await fillForm();
    await submit(user);

    expect(signInEmail).toHaveBeenCalledWith(credentials);
    expect(push).toHaveBeenCalledWith('/boards');
  });

  it('shows a generic message when the password is wrong', async () => {
    render(<SignInForm />);

    signInEmail.mockResolvedValue(invalidCredentials);
    const user = await fillForm({ password: 'not-the-password' });
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the same message for an email that is not registered', async () => {
    const wrongPassword = await alertTextFor(invalidCredentials, { password: 'not-the-password' });
    const unknownEmail = await alertTextFor(invalidCredentials, {
      email: 'nobody@example.com',
    });

    expect(unknownEmail).toBe(wrongPassword);
    expect(unknownEmail).not.toContain('nobody@example.com');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the same message even when the server answers USER_NOT_FOUND', async () => {
    // Guards the no-enumeration rule: if a future change gave this code its own
    // wording, an attacker could tell registered emails from unregistered ones.
    const wrongPassword = await alertTextFor(invalidCredentials, { password: 'not-the-password' });
    const userNotFound = await alertTextFor({
      data: null,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        status: 401,
        statusText: 'Unauthorized',
      },
    });

    expect(userNotFound).toBe(wrongPassword);
    expect(push).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format without calling Better Auth', async () => {
    render(<SignInForm />);

    const user = await fillForm({ email: 'ada@' });
    await submit(user);

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('rejects an empty password without calling Better Auth', async () => {
    render(<SignInForm />);

    const user = await fillForm({ password: '' });
    await submit(user);

    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a generic message instead of the server message when the server fails unexpectedly', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    signInEmail.mockResolvedValue({
      data: null,
      error: { message: leakyMessage, status: 500, statusText: 'Internal Server Error' },
    });
    render(<SignInForm />);

    const user = await fillForm();
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.queryByText(leakyMessage)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('10.0.0.5');
    expect(push).not.toHaveBeenCalled();
  });

  it('clears a stale form-level API error when resubmitting with invalid input', async () => {
    signInEmail.mockResolvedValue(invalidCredentials);
    render(<SignInForm />);

    const user = await fillForm({ password: 'not-the-password' });
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');

    await user.clear(screen.getByLabelText('Password'));
    await submit(user);

    expect(screen.queryByText('Invalid email or password.')).not.toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(signInEmail).toHaveBeenCalledTimes(1);
  });
});
