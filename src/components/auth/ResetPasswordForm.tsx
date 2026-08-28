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
import { SIGN_IN_PATH } from '@/lib/routes';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validation/resetPassword';

const INVALID_LINK_MESSAGE = 'This reset link is invalid or has expired.';
const SUCCESS_MESSAGE = 'Your password has been updated.';

type ResetPasswordFormProps = {
  token?: string;
  error?: string;
};

export default function ResetPasswordForm({ token, error }: ResetPasswordFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const hasValidToken = Boolean(token) && error !== 'INVALID_TOKEN';

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values: ResetPasswordInput) {
    if (!token) {
      form.setError('root', { message: INVALID_LINK_MESSAGE });
      return;
    }

    const { error: resetError } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });

    if (resetError) {
      form.setError('root', {
        message: resetError.code === 'INVALID_TOKEN' ? INVALID_LINK_MESSAGE : GENERIC_ERROR_MESSAGE,
      });
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className={authFormClassName}>
        <p role="status" className={authFormSuccessBandClassName}>
          {SUCCESS_MESSAGE}
        </p>
        <p className={authFooterClassName}>
          <Link href={SIGN_IN_PATH} className={authFooterLinkClassName}>
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  if (!hasValidToken) {
    return (
      <div className={authFormClassName}>
        <p role="alert" className={authFormErrorBandClassName}>
          {INVALID_LINK_MESSAGE}
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
        <h1 className={authFormTitleClassName}>Reset password</h1>
        <p className={authFormSubtitleClassName}>Choose a new password for your account.</p>
      </div>

      {form.formState.errors.root?.message && (
        <p role="alert" className={authFormErrorBandClassName}>
          {form.formState.errors.root.message}
        </p>
      )}

      <FieldGroup className={authFieldGroupClassName}>
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className={authFieldClassName}>
              <FieldLabel htmlFor={field.name} className={authFieldLabelClassName}>
                Password
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                autoComplete="new-password"
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

        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className={authFieldClassName}>
              <FieldLabel htmlFor={field.name} className={authFieldLabelClassName}>
                Confirm password
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? 'confirm-password-error' : undefined}
                className={authInputClassName}
              />
              {fieldState.invalid && (
                <FieldError
                  id="confirm-password-error"
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
            Resetting...
          </>
        ) : (
          'Reset password'
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
