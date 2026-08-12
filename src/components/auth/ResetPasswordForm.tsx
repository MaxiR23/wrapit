'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/authClient';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { SIGN_IN_PATH } from '@/lib/routes';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validation/resetPassword';

const INVALID_LINK_MESSAGE = 'This reset link is invalid or has expired.';

type ResetPasswordFormProps = {
  token?: string;
  error?: string;
};

export default function ResetPasswordForm({ token, error }: ResetPasswordFormProps) {
  const router = useRouter();
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

    router.push(SIGN_IN_PATH);
  }

  if (!hasValidToken) {
    return <p role="alert">{INVALID_LINK_MESSAGE}</p>;
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
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
      </div>

      {form.formState.errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {form.formState.errors.root.message}
        </p>
      )}

      <FieldGroup>
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? 'password-error' : undefined}
              />
              {fieldState.invalid && <FieldError id="password-error" errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? 'confirm-password-error' : undefined}
              />
              {fieldState.invalid && (
                <FieldError id="confirm-password-error" errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Resetting...' : 'Reset password'}
      </Button>
    </form>
  );
}
