import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';
import { idSchema } from '@/lib/validation/id';

export const MAX_SUBTASK_TEXT_LENGTH = 200;

export const SUBTASK_FIELDS = ['text', 'done'] as const;

export const createSubtaskSchema = z.object({
  cardId: idSchema,
  text: z.string().trim().min(1, 'Text is required').max(MAX_SUBTASK_TEXT_LENGTH),
});

export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;
export type CreateSubtaskErrors = FieldErrors<CreateSubtaskInput>;

export const deleteSubtaskSchema = z.object({
  subtaskId: idSchema,
});

export const updateSubtaskFieldSchema = z.discriminatedUnion('field', [
  z.object({
    subtaskId: idSchema,
    field: z.literal('text'),
    value: z.string().trim().min(1, 'Text is required').max(MAX_SUBTASK_TEXT_LENGTH),
  }),
  z.object({
    subtaskId: idSchema,
    field: z.literal('done'),
    value: z.boolean(),
  }),
]);

export type UpdateSubtaskFieldInput = z.infer<typeof updateSubtaskFieldSchema>;
export type UpdateSubtaskFieldErrors = FieldErrors<{ value: string }>;

export function validateCreateSubtask(input: CreateSubtaskInput): CreateSubtaskErrors {
  const result = createSubtaskSchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}
