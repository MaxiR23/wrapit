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
import { BOARDS_PATH, SIGN_IN_PATH } from '@/lib/routes';
import { signUpSchema, type SignUpInput } from '@/lib/validation/signUp';

// Better Auth answers a duplicate email with 422 and this code. The plain
// USER_ALREADY_EXISTS code covers configurations that do not append the hint.
const EMAIL_TAKEN_CODES = ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'USER_ALREADY_EXISTS'];

const EMAIL_TAKEN_MESSAGE = 'That email is already registered.';

export default function SignUpForm() {
  const router = useRouter();

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values: SignUpInput) {
    // The client returns { data, error } instead of throwing.
    const { error } = await authClient.signUp.email(values);

    if (error) {
      if (error.code && EMAIL_TAKEN_CODES.includes(error.code)) {
        form.setError('email', { message: EMAIL_TAKEN_MESSAGE });
      } else {
        // Only recognized codes get a specific message.
        form.setError('root', { message: GENERIC_ERROR_MESSAGE });
      }
      return;
    }

    router.push(BOARDS_PATH);
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
        <h1 className={authFormTitleClassName}>Create account</h1>
        <p className={authFormSubtitleClassName}>Start with your first board.</p>
      </div>

      {form.formState.errors.root?.message && (
        <p role="alert" className={authFormErrorBandClassName}>
          {form.formState.errors.root.message}
        </p>
      )}

      <FieldGroup className={authFieldGroupClassName}>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className={authFieldClassName}>
              <FieldLabel htmlFor={field.name} className={authFieldLabelClassName}>
                Name
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                autoComplete="name"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? 'name-error' : undefined}
                className={authInputClassName}
              />
              {fieldState.invalid && (
                <FieldError
                  id="name-error"
                  errors={[fieldState.error]}
                  className={authFieldErrorClassName}
                />
              )}
            </Field>
          )}
        />

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
      </FieldGroup>

      <Button type="submit" disabled={form.formState.isSubmitting} className={authButtonClassName}>
        {form.formState.isSubmitting ? (
          <>
            <AuthFormSpinner />
            Creating account...
          </>
        ) : (
          'Create account'
        )}
      </Button>

      <p className={authFooterClassName}>
        Already have an account?{' '}
        <Link href={SIGN_IN_PATH} className={authFooterLinkClassName}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
