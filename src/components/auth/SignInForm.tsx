'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
  authFormSuccessBandClassName,
  authFormTitleClassName,
  authInputClassName,
} from '@/components/auth/formClasses';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/authClient';
import {
  EMAIL_NOT_VERIFIED_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  VERIFICATION_RATE_LIMIT_MESSAGE,
  VERIFICATION_RESEND_CONFIRMATION,
} from '@/lib/messages';
import { PROJECTS_PATH, FORGOT_PASSWORD_PATH, SIGN_UP_PATH, VERIFY_EMAIL_PATH } from '@/lib/routes';
import { signInSchema, type SignInInput } from '@/lib/validation/signIn';

// Better Auth answers both a wrong password and an email that was never
// registered with the same 401 INVALID_EMAIL_OR_PASSWORD. The other codes are
// listed so a configuration that does tell them apart still lands on the same
// message here: a failed sign in must never reveal whether an email exists.
const CREDENTIALS_ERROR_CODES = ['INVALID_EMAIL_OR_PASSWORD', 'USER_NOT_FOUND', 'INVALID_PASSWORD'];

const CREDENTIALS_ERROR_MESSAGE = 'Invalid email or password.';

function isUnverifiedError(error: { status?: number; code?: string | null }): boolean {
  return error.status === 403 || error.code === 'EMAIL_NOT_VERIFIED';
}

export default function SignInForm() {
  const router = useRouter();
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const showUnverified = form.formState.errors.root?.message === EMAIL_NOT_VERIFIED_MESSAGE;

  async function onSubmit(values: SignInInput) {
    setResendStatus('idle');
    // The client returns { data, error } instead of throwing.
    const { error } = await authClient.signIn.email(values);

    if (error) {
      if (isUnverifiedError(error)) {
        form.setError('root', { message: EMAIL_NOT_VERIFIED_MESSAGE });
        return;
      }

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

    router.push(PROJECTS_PATH);
    router.refresh();
  }

  async function onResend() {
    const email = form.getValues('email');
    setResendStatus('sending');
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: VERIFY_EMAIL_PATH,
    });

    if (error) {
      setResendStatus('idle');
      form.setError('root', {
        message: error.status === 429 ? VERIFICATION_RATE_LIMIT_MESSAGE : GENERIC_ERROR_MESSAGE,
      });
      return;
    }

    setResendStatus('sent');
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
        <p className={authFormSubtitleClassName}>Access your projects.</p>
      </div>

      {form.formState.errors.root?.message && (
        <p role="alert" className={authFormErrorBandClassName}>
          {form.formState.errors.root.message}
        </p>
      )}

      {resendStatus === 'sent' && (
        <p role="status" className={authFormSuccessBandClassName}>
          {VERIFICATION_RESEND_CONFIRMATION}
        </p>
      )}

      {showUnverified && resendStatus !== 'sent' && (
        <Button
          type="button"
          disabled={resendStatus === 'sending'}
          onClick={() => {
            void onResend();
          }}
          className={authButtonClassName}
        >
          {resendStatus === 'sending' ? (
            <>
              <AuthFormSpinner />
              Sending...
            </>
          ) : (
            'Send a new verification email'
          )}
        </Button>
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
