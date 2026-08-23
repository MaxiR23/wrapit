import { z } from 'zod';

import { LABEL_TONES } from '@/lib/labelTones';
import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';
import { idSchema } from '@/lib/validation/id';

export const MAX_LABEL_FIELD_LENGTH = 200;

export const LABEL_FIELDS = ['name', 'tone'] as const;

export const createLabelSchema = z.object({
  projectId: idSchema,
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type CreateLabelErrors = FieldErrors<CreateLabelInput>;

export const deleteLabelSchema = z.object({
  labelId: idSchema,
});

export type DeleteLabelInput = z.infer<typeof deleteLabelSchema>;
export type DeleteLabelErrors = FieldErrors<DeleteLabelInput>;

export const updateLabelFieldSchema = z
  .object({
    labelId: idSchema,
    field: z.enum(LABEL_FIELDS),
    value: z.string().trim().max(MAX_LABEL_FIELD_LENGTH),
  })
  .superRefine((data, ctx) => {
    if (data.field === 'name' && data.value.length < 1) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Name is required' });
    }
    if (data.field === 'tone' && !(LABEL_TONES as readonly string[]).includes(data.value)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Invalid tone' });
    }
  });

export type UpdateLabelFieldInput = z.infer<typeof updateLabelFieldSchema>;
export type UpdateLabelFieldErrors = FieldErrors<UpdateLabelFieldInput>;

export function validateCreateLabel(input: CreateLabelInput): CreateLabelErrors {
  const result = createLabelSchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}

export function validateDeleteLabel(input: DeleteLabelInput): DeleteLabelErrors {
  const result = deleteLabelSchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}

export function validateUpdateLabelField(input: UpdateLabelFieldInput): UpdateLabelFieldErrors {
  const result = updateLabelFieldSchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}
