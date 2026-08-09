'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { errorTextClasses, inputClasses, submitButtonClasses } from '@/components/auth/formStyles';
import { authClient } from '@/lib/authClient';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { HOME_PATH } from '@/lib/routes';
import { validateSignUp, type SignUpFieldErrors } from '@/lib/validation/signUp';

// Better Auth answers a duplicate email with 422 and this code. The plain
// USER_ALREADY_EXISTS code covers configurations that do not append the hint.
const EMAIL_TAKEN_CODES = ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'USER_ALREADY_EXISTS'];

const EMAIL_TAKEN_MESSAGE = 'That email is already registered.';

export default function SignUpForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validateSignUp({ name, email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    // The client returns { data, error } instead of throwing.
    const { error } = await authClient.signUp.email({ name, email, password });

    if (error) {
      if (error.code && EMAIL_TAKEN_CODES.includes(error.code)) {
        setFieldErrors({ email: EMAIL_TAKEN_MESSAGE });
      } else {
        // Only recognized codes get a specific message.
        setFormError(GENERIC_ERROR_MESSAGE);
      }
      setIsSubmitting(false);
      return;
    }

    router.push(HOME_PATH);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">Create your account</h1>

      {formError && (
        <p role="alert" className={errorTextClasses}>
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'name-error' : undefined}
          className={inputClasses}
        />
        {fieldErrors.name && (
          <p id="name-error" className={errorTextClasses}>
            {fieldErrors.name}
          </p>
        )}
      </div>

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
          <p id="email-error" className={errorTextClasses}>
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
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          className={inputClasses}
        />
        {fieldErrors.password && (
          <p id="password-error" className={errorTextClasses}>
            {fieldErrors.password}
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} className={submitButtonClasses}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}
