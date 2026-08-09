'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { authClient } from '@/app/lib/authClient';
import { validateSignIn, type SignInFieldErrors } from '@/app/lib/validation/signIn';

// Better Auth answers both a wrong password and an email that was never
// registered with the same 401 INVALID_EMAIL_OR_PASSWORD. The other codes are
// listed so a configuration that does tell them apart still lands on the same
// message here: a failed sign in must never reveal whether an email exists.
const CREDENTIALS_ERROR_CODES = ['INVALID_EMAIL_OR_PASSWORD', 'USER_NOT_FOUND', 'INVALID_PASSWORD'];

const CREDENTIALS_ERROR_MESSAGE = 'Invalid email or password.';
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const inputClasses =
  'w-full rounded border border-gray-300 px-3 py-2 outline-none focus:border-gray-900';

export default function SignInForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validateSignIn({ email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    // The client returns { data, error } instead of throwing.
    const { error } = await authClient.signIn.email({ email, password });

    if (error) {
      // A rejected credential is always a form-level error, never a field one.
      // Pinning it on the email input would itself hint that the email is the
      // part that was wrong.
      const isCredentialsError =
        error.status === 401 || (error.code ? CREDENTIALS_ERROR_CODES.includes(error.code) : false);

      // Only recognized failures get specific wording. Never render
      // error.message from an unrecognized failure: it can carry server
      // internals the user should not see.
      setFormError(isCredentialsError ? CREDENTIALS_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE);
      setIsSubmitting(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">Sign in to wrapit</h1>

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          className={inputClasses}
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-sm text-red-600">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          className={inputClasses}
        />
        {fieldErrors.password && (
          <p id="password-error" className="text-sm text-red-600">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
