'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
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
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { RESET_PASSWORD_PATH, SIGN_IN_PATH } from '@/lib/routes';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validation/forgotPassword';

const CONFIRMATION_MESSAGE = 'If that email is registered, a reset link is on its way.';

export default function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: RESET_PASSWORD_PATH,
    });

    if (error) {
      form.setError('root', { message: GENERIC_ERROR_MESSAGE });
      return;
    }

    setSubmitted(true);
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        form.clearErrors('root');
        void form.handleSubmit(onSubmit)(event);
      }}
      className={authFormClassName}
    >
      <div className={authFormHeaderClassName}>
        <h1 className={authFormTitleClassName}>Forgot password</h1>
        <p className={authFormSubtitleClassName}>
          Enter your email and we will send a reset link if an account exists.
        </p>
      </div>

      {submitted ? (
        <p role="status" className={authFormSuccessBandClassName}>
          {CONFIRMATION_MESSAGE}
        </p>
      ) : null}

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
      </FieldGroup>

      <Button type="submit" disabled={form.formState.isSubmitting} className={authButtonClassName}>
        {form.formState.isSubmitting ? (
          <>
            <AuthFormSpinner />
            Sending...
          </>
        ) : (
          'Send reset link'
        )}
      </Button>

      <p className={authFooterClassName}>
        <Link href={SIGN_IN_PATH} className={authFooterLinkClassName}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
