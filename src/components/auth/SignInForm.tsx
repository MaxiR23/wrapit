'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';

import AuthFormSpinner from '@/components/auth/AuthFormSpinner';
import {
  authButtonClassName,
  authFieldClassName,
  authFieldErrorClassName,
  authFieldGroupClassName,
  authFieldLabelClassName,
  authFooterClassName,
  authFooterLinkClassName,
  authForgotLinkDesktopClassName,
  authForgotLinkMobileClassName,
  authFormClassName,
  authFormErrorBandClassName,
  authFormHeaderClassName,
  authFormSubtitleClassName,
  authFormTitleClassName,
  authInputClassName,
} from '@/components/auth/formClasses';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/authClient';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { BOARDS_PATH, FORGOT_PASSWORD_PATH, SIGN_UP_PATH } from '@/lib/routes';
import { signInSchema, type SignInInput } from '@/lib/validation/signIn';

// Better Auth answers both a wrong password and an email that was never
// registered with the same 401 INVALID_EMAIL_OR_PASSWORD. The other codes are
// listed so a configuration that does tell them apart still lands on the same
// message here: a failed sign in must never reveal whether an email exists.
const CREDENTIALS_ERROR_CODES = ['INVALID_EMAIL_OR_PASSWORD', 'USER_NOT_FOUND', 'INVALID_PASSWORD'];

const CREDENTIALS_ERROR_MESSAGE = 'Invalid email or password.';

export default function SignInForm() {
  const router = useRouter();

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignInInput) {
    // The client returns { data, error } instead of throwing.
    const { error } = await authClient.signIn.email(values);

    if (error) {
      // A rejected credential is always a form-level error, never a field one.
      // Pinning it on the email input would itself hint that the email is the
      // part that was wrong.
      const isCredentialsError =
        error.status === 401 || (error.code ? CREDENTIALS_ERROR_CODES.includes(error.code) : false);

      // Only recognized failures get specific wording.
      form.setError('root', {
        message: isCredentialsError ? CREDENTIALS_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE,
      });
      return;
    }

    router.push(BOARDS_PATH);
    router.refresh();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        // Clear before handleSubmit so a stale API root error does not linger
        // when client validation fails and onSubmit never runs.
        form.clearErrors('root');
        void form.handleSubmit(onSubmit)(event);
      }}
      className={authFormClassName}
    >
      <div className={authFormHeaderClassName}>
        <h1 className={authFormTitleClassName}>Sign in</h1>
        <p className={authFormSubtitleClassName}>Access your boards.</p>
      </div>

      {form.formState.errors.root?.message && (
        <p role="alert" className={authFormErrorBandClassName}>
          {form.formState.errors.root.message}
        </p>
      )}

      <FieldGroup className={authFieldGroupClassName}>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className={authFieldClassName}>
              <FieldLabel htmlFor={field.name} className={authFieldLabelClassName}>
                Email
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? 'email-error' : undefined}
                className={authInputClassName}
              />
              {fieldState.invalid && (
                <FieldError
                  id="email-error"
                  errors={[fieldState.error]}
                  className={authFieldErrorClassName}
                />
              )}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className={authFieldClassName}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={field.name} className={authFieldLabelClassName}>
                  Password
                </FieldLabel>
                <Link href={FORGOT_PASSWORD_PATH} className={authForgotLinkDesktopClassName}>
                  Forgot password?
                </Link>
              </div>
              <Input
                {...field}
                id={field.name}
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? 'password-error' : undefined}
                className={authInputClassName}
              />
              {fieldState.invalid && (
                <FieldError
                  id="password-error"
                  errors={[fieldState.error]}
                  className={authFieldErrorClassName}
                />
              )}
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" disabled={form.formState.isSubmitting} className={authButtonClassName}>
        {form.formState.isSubmitting ? (
          <>
            <AuthFormSpinner />
            Signing in...
          </>
        ) : (
          'Sign in'
        )}
      </Button>

      <Link href={FORGOT_PASSWORD_PATH} className={authForgotLinkMobileClassName}>
        Forgot password?
      </Link>

      <p className={authFooterClassName}>
        No account?{' '}
        <Link href={SIGN_UP_PATH} className={authFooterLinkClassName}>
          Create one
        </Link>
      </p>
    </form>
  );
}
