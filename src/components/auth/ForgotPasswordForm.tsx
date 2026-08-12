'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/authClient';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { RESET_PASSWORD_PATH } from '@/lib/routes';
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

  if (submitted) {
    return <p role="status">{CONFIRMATION_MESSAGE}</p>;
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        form.clearErrors('root');
        void form.handleSubmit(onSubmit)(event);
      }}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="mb-2 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we will send a reset link if an account exists.
        </p>
      </div>

      {form.formState.errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {form.formState.errors.root.message}
        </p>
      )}

      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? 'email-error' : undefined}
              />
              {fieldState.invalid && <FieldError id="email-error" errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Sending...' : 'Send reset link'}
      </Button>
    </form>
  );
}
