'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';

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

// Present when the username plugin is used; with additionalFields a duplicate
// username hits the DB unique constraint and usually surfaces as a generic
// FAILED_TO_CREATE_USER, which falls through to GENERIC_ERROR_MESSAGE on root.
const USERNAME_TAKEN_CODES = ['USERNAME_IS_ALREADY_TAKEN'];

const EMAIL_TAKEN_MESSAGE = 'That email is already registered.';
const USERNAME_TAKEN_MESSAGE = 'That username is already taken.';

export default function SignUpForm() {
  const router = useRouter();

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onTouched',
    defaultValues: { username: '', name: '', email: '', password: '' },
  });

  async function onSubmit(values: SignUpInput) {
    // The client returns { data, error } instead of throwing.
    const { error } = await authClient.signUp.email(values);

    if (error) {
      if (error.code && EMAIL_TAKEN_CODES.includes(error.code)) {
        form.setError('email', { message: EMAIL_TAKEN_MESSAGE });
      } else if (error.code && USERNAME_TAKEN_CODES.includes(error.code)) {
        form.setError('username', { message: USERNAME_TAKEN_MESSAGE });
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
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="mb-2 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground">Start with your first board.</p>
      </div>

      {form.formState.errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {form.formState.errors.root.message}
        </p>
      )}

      <FieldGroup>
        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Username</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                autoComplete="username"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? 'username-error' : undefined}
              />
              {fieldState.invalid && <FieldError id="username-error" errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                autoComplete="name"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? 'name-error' : undefined}
              />
              {fieldState.invalid && <FieldError id="name-error" errors={[fieldState.error]} />}
            </Field>
          )}
        />

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
      </FieldGroup>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Creating account...' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href={SIGN_IN_PATH} className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
