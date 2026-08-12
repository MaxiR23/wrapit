// tests/components/auth/SignUpForm.test.tsx
//
// Tests for the sign up form.
//
// Tested:
// - Renders the username, name, email and password fields
// - Signs the user up with the typed values and redirects to the app
// - Shows a clear message when the email is already registered
// - Shows a clear message when the username is already taken
// - Rejects an invalid email format without calling Better Auth
// - Rejects a password shorter than the minimum without calling Better Auth
// - Rejects empty fields without calling Better Auth
// - Shows a generic message, not the server message, when the server fails
// - Shows a generic message for an unrecognized error code
// - Clears a stale form-level API error when resubmitting with invalid input
//
// What is covered:
// - Happy path, invalid input, duplicate email, duplicate username, unexpected
//   server error, unrecognized error code, stale root error on invalid resubmit
//
// Run with: pnpm test:run tests/components/auth/SignUpForm.test.tsx
//
// SEE: src/components/auth/SignUpForm.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MIN_PASSWORD_LENGTH } from '@/lib/validation/signUp';

const signUpEmail = vi.fn();
const push = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { signUp: { email: signUpEmail } },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const { default: SignUpForm } = await import('@/components/auth/SignUpForm');

const credentials = {
  username: 'ada',
  name: 'Ada',
  email: 'ada@example.com',
  password: 'a-long-enough-password',
};

async function fillForm(fields: Partial<typeof credentials> = {}) {
  const values = { ...credentials, ...fields };
  const user = userEvent.setup();

  if (values.username) await user.type(screen.getByLabelText('Username'), values.username);
  if (values.name) await user.type(screen.getByLabelText('Name'), values.name);
  if (values.email) await user.type(screen.getByLabelText('Email'), values.email);
  if (values.password) await user.type(screen.getByLabelText('Password'), values.password);

  return user;
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signUpEmail.mockResolvedValue({ data: { user: { email: credentials.email } }, error: null });
  });

  it('renders the username, name, email and password fields', () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('signs the user up with the typed values and redirects to the app', async () => {
    render(<SignUpForm />);

    const user = await fillForm();
    await submit(user);

    expect(signUpEmail).toHaveBeenCalledWith(credentials);
    expect(push).toHaveBeenCalledWith('/boards');
  });

  it('shows a clear message when the email is already registered', async () => {
    signUpEmail.mockResolvedValue({
      data: null,
      error: {
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists. Use another email.',
        status: 422,
        statusText: 'Unprocessable Entity',
      },
    });
    render(<SignUpForm />);

    const user = await fillForm();
    await submit(user);

    expect(await screen.findByText('That email is already registered.')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a clear message when the username is already taken', async () => {
    signUpEmail.mockResolvedValue({
      data: null,
      error: {
        code: 'USERNAME_IS_ALREADY_TAKEN',
        message: 'Username is already taken. Please try another.',
        status: 400,
        statusText: 'Bad Request',
      },
    });
    render(<SignUpForm />);

    const user = await fillForm();
    await submit(user);

    expect(await screen.findByText('That username is already taken.')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format without calling Better Auth', async () => {
    render(<SignUpForm />);

    const user = await fillForm({ email: 'ada@' });
    await submit(user);

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than the minimum without calling Better Auth', async () => {
    render(<SignUpForm />);

    const user = await fillForm({ password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1) });
    await submit(user);

    expect(
      await screen.findByText(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    ).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('rejects empty fields without calling Better Auth', async () => {
    render(<SignUpForm />);

    const user = userEvent.setup();
    await submit(user);

    expect(await screen.findByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(
      screen.getByText(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    ).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('shows a generic message instead of the server message when the server fails unexpectedly', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    signUpEmail.mockResolvedValue({
      data: null,
      error: { message: leakyMessage, status: 500, statusText: 'Internal Server Error' },
    });
    render(<SignUpForm />);

    const user = await fillForm();
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.queryByText(leakyMessage)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('10.0.0.5');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a generic message for an unrecognized error code, not the server message', async () => {
    signUpEmail.mockResolvedValue({
      data: null,
      error: {
        code: 'SOME_UNRECOGNIZED_CODE',
        message: 'Internal detail: user table constraint "User_email_key" violated',
        status: 400,
        statusText: 'Bad Request',
      },
    });
    render(<SignUpForm />);

    const user = await fillForm();
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('User_email_key');
    expect(push).not.toHaveBeenCalled();
  });

  it('clears a stale form-level API error when resubmitting with invalid input', async () => {
    signUpEmail.mockResolvedValue({
      data: null,
      error: { message: 'boom', status: 500, statusText: 'Internal Server Error' },
    });
    render(<SignUpForm />);

    const user = await fillForm();
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );

    await user.clear(screen.getByLabelText('Password'));
    await submit(user);

    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
    expect(
      await screen.findByText(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    ).toBeInTheDocument();
    expect(signUpEmail).toHaveBeenCalledTimes(1);
  });
});
