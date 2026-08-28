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
import {
  GENERIC_ERROR_MESSAGE,
  VERIFICATION_RATE_LIMIT_MESSAGE,
  VERIFICATION_RESEND_CONFIRMATION,
} from '@/lib/messages';
import { SIGN_IN_PATH, VERIFY_EMAIL_PATH } from '@/lib/routes';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validation/forgotPassword';

type CheckEmailPanelProps = {
  email?: string;
};

export default function CheckEmailPanel({ email = '' }: CheckEmailPanelProps) {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const { error } = await authClient.sendVerificationEmail({
      email: values.email,
      callbackURL: VERIFY_EMAIL_PATH,
    });

    if (error) {
      form.setError('root', {
        message: error.status === 429 ? VERIFICATION_RATE_LIMIT_MESSAGE : GENERIC_ERROR_MESSAGE,
      });
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className={authFormClassName}>
        <p role="status" className={authFormSuccessBandClassName}>
          {VERIFICATION_RESEND_CONFIRMATION}
        </p>
        <p className={authFooterClassName}>
          <Link href={SIGN_IN_PATH} className={authFooterLinkClassName}>
            Sign in
          </Link>
        </p>
      </div>
    );
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
        <h1 className={authFormTitleClassName}>Check your email</h1>
        <p className={authFormSubtitleClassName}>
          The account is created. Open the link we sent to verify it. The link expires in 24 hours.
        </p>
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
      </FieldGroup>

      <Button type="submit" disabled={form.formState.isSubmitting} className={authButtonClassName}>
        {form.formState.isSubmitting ? (
          <>
            <AuthFormSpinner />
            Sending...
          </>
        ) : (
          'Send a new link'
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
