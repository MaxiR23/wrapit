'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { createColumn } from '@/actions/createColumn';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { columnSchema, type ColumnInput } from '@/lib/validation/column';

export default function NewColumnDialog({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ColumnInput>({
    resolver: zodResolver(columnSchema),
    defaultValues: { title: '' },
  });

  async function onSubmit(values: ColumnInput) {
    const result = await createColumn({ boardId, title: values.title });

    if ('fieldErrors' in result && result.fieldErrors.title) {
      form.setError('title', { message: result.fieldErrors.title });
      return;
    }

    if ('error' in result) {
      setFormError(GENERIC_ERROR_MESSAGE);
      return;
    }

    form.reset();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          form.reset();
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">New column</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New column</DialogTitle>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(event) => {
            // Clear before handleSubmit so a stale API form error does not linger
            // when client validation fails and onSubmit never runs.
            setFormError(null);
            void form.handleSubmit(onSubmit)(event);
          }}
          className="flex flex-col gap-4"
        >
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.invalid ? 'title-error' : undefined}
                  />
                  {fieldState.invalid && (
                    <FieldError id="title-error" errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating...' : 'Create column'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
