'use client';

import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { createProject } from '@/actions/createProject';
import { shellFocusClassName } from '@/components/projects/shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { projectStatusLabel } from '@/lib/projectGrid';
import { cn } from '@/lib/utils';
import {
  CREATE_PROJECT_STATUSES,
  projectSchema,
  type ProjectInput,
} from '@/lib/validation/project';

const statusToggleClassName = 'h-[30px] flex-1 rounded-[6px] px-3 text-[12.5px] font-medium';

const defaultValues: ProjectInput = {
  title: '',
  description: '',
  status: 'NEW',
  featured: false,
};

export default function NewProjectDialog({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues,
  });

  const titleValue = useWatch({ control: form.control, name: 'title', defaultValue: '' });
  const canCreate = titleValue.trim().length > 0 && !form.formState.isSubmitting;

  async function onSubmit(values: ProjectInput) {
    const result = await createProject({
      title: values.title,
      description: values.description,
      status: values.status ?? 'NEW',
      featured: values.featured ?? false,
    });

    if ('fieldErrors' in result) {
      const { fieldErrors } = result;
      if (fieldErrors.title) {
        form.setError('title', { message: fieldErrors.title });
      }
      if (fieldErrors.description) {
        form.setError('description', { message: fieldErrors.description });
      }
      if (fieldErrors.status) {
        form.setError('status', { message: fieldErrors.status });
      }
      if (fieldErrors.featured) {
        form.setError('featured', { message: fieldErrors.featured });
      }
      return;
    }

    if ('error' in result) {
      setFormError(GENERIC_ERROR_MESSAGE);
      return;
    }

    form.reset(defaultValues);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          form.reset(defaultValues);
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {children ?? <Button type="button">New project</Button>}
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        aria-modal="true"
        overlayClassName="bg-black/62"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-[540px] flex-col gap-0 overflow-hidden rounded-[14px] border border-border-strong bg-surface p-0 text-foreground shadow-[0_30px_70px_oklch(0_0_0/0.6)] sm:max-w-[540px]"
      >
        <form
          noValidate
          onSubmit={(event) => {
            setFormError(null);
            void form.handleSubmit(onSubmit)(event);
          }}
          className="flex min-h-0 flex-col"
        >
          <DialogHeader className="flex-row items-center gap-3 border-b border-border p-[18px_20px]">
            <div className="mr-auto flex flex-col gap-[3px]">
              <DialogTitle className="text-base font-semibold tracking-[-0.01em]">
                New project
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground">
                Created with the board&apos;s default columns
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                className={cn(
                  shellFocusClassName,
                  'inline-flex size-[30px] shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-card hover:text-foreground',
                )}
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
            </DialogClose>
          </DialogHeader>

          <div className="flex flex-col gap-[18px] overflow-auto p-5">
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <FieldGroup className="gap-[18px]">
              <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-[7px]">
                    <FieldLabel
                      htmlFor="new-project-name"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Name
                    </FieldLabel>
                    <Input
                      {...field}
                      id="new-project-name"
                      placeholder="What's the project called"
                      autoComplete="off"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={fieldState.invalid ? 'new-project-name-error' : undefined}
                      className="h-[38px] rounded-md bg-background px-3 text-[13.5px]"
                    />
                    {fieldState.invalid && (
                      <FieldError id="new-project-name-error" errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-[7px]">
                    <FieldLabel
                      htmlFor="new-project-description"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Description
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="new-project-description"
                      rows={3}
                      placeholder="Project goal and scope"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.invalid ? 'new-project-description-error' : undefined
                      }
                      className="min-h-0 resize-none rounded-md bg-background px-3 py-2.5 text-[13.5px] leading-normal"
                    />
                    {fieldState.invalid && (
                      <FieldError id="new-project-description-error" errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="status"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-2">
                    <FieldLabel className="text-xs font-medium text-muted-foreground">
                      Initial status
                    </FieldLabel>
                    <div
                      role="group"
                      aria-label="Initial status"
                      className="flex gap-[3px] rounded-md border border-border bg-background p-[3px]"
                    >
                      {CREATE_PROJECT_STATUSES.map((status) => {
                        const selected = field.value === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => field.onChange(status)}
                            className={cn(
                              shellFocusClassName,
                              statusToggleClassName,
                              selected
                                ? 'bg-card text-foreground'
                                : 'bg-transparent text-muted-foreground',
                            )}
                          >
                            {projectStatusLabel(status)}
                          </button>
                        );
                      })}
                    </div>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="featured"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-2">
                    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(field.value)}
                        onChange={(event) => field.onChange(event.target.checked)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        className={cn(
                          shellFocusClassName,
                          'size-4 shrink-0 rounded-[5px] border-[1.5px] border-border-strong accent-foreground',
                        )}
                      />
                      Mark as featured
                    </label>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
          </div>

          <div className="flex items-center gap-2 border-t border-border p-4 px-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="ml-auto h-9 px-3.5 text-[13px]">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!canCreate}
              className="h-9 px-4 text-[13px] font-semibold disabled:opacity-45"
            >
              {form.formState.isSubmitting ? 'Creating...' : 'Create project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
