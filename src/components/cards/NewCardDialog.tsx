'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { createCard } from '@/actions/createCard';
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
import { Textarea } from '@/components/ui/textarea';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { cardSchema, type CardInput } from '@/lib/validation/card';

export default function NewCardDialog({
  columnId,
  columnTitle,
}: {
  columnId: string;
  columnTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CardInput>({
    resolver: zodResolver(cardSchema),
    defaultValues: { title: '', description: '' },
  });

  async function onSubmit(values: CardInput) {
    const result = await createCard({
      columnId,
      title: values.title,
      description: values.description,
    });

    if ('fieldErrors' in result) {
      if (result.fieldErrors.title) {
        form.setError('title', { message: result.fieldErrors.title });
      }
      if (result.fieldErrors.description) {
        form.setError('description', { message: result.fieldErrors.description });
      }
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
        <Button type="button" size="sm" variant="outline" aria-label={`New card in ${columnTitle}`}>
          New card
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New card</DialogTitle>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(event) => {
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
                  <FieldLabel htmlFor={`new-card-title-${columnId}`}>Title</FieldLabel>
                  <Input
                    {...field}
                    id={`new-card-title-${columnId}`}
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? `new-card-title-error-${columnId}` : undefined
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError
                      id={`new-card-title-error-${columnId}`}
                      errors={[fieldState.error]}
                    />
                  )}
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`new-card-description-${columnId}`}>Description</FieldLabel>
                  <Textarea
                    {...field}
                    id={`new-card-description-${columnId}`}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating...' : 'Create card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
