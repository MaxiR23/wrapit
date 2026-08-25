import { z } from 'zod';

import { dueDateFromCalendarDay } from '@/lib/cardDue';
import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';
import { idSchema } from '@/lib/validation/id';

export const DUE_DATE_MESSAGE = 'Enter a valid date';

export const MAX_CARD_ASSIGNEES = 20;

export const cardSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
});

export type CardInput = z.infer<typeof cardSchema>;

const optionalDueDateSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, DUE_DATE_MESSAGE)
    .refine((day) => dueDateFromCalendarDay(day) !== null, DUE_DATE_MESSAGE)
    .optional(),
);

export const createCardSchema = cardSchema.extend({
  columnId: idSchema,
  labelId: idSchema.optional(),
  dueDate: optionalDueDateSchema,
  assigneeIds: z.array(idSchema).max(MAX_CARD_ASSIGNEES).optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;

export type CardFieldErrors = FieldErrors<CardInput & { dueDate?: string }>;

export const updateCardSchema = cardSchema.extend({
  cardId: idSchema,
});

export const deleteCardSchema = z.object({
  cardId: idSchema,
});

export const archiveCardSchema = z.object({
  cardId: idSchema,
});

export const CARD_FIELDS = ['title', 'description', 'dueDate'] as const;

export const updateCardFieldSchema = z
  .object({
    cardId: idSchema,
    field: z.enum(CARD_FIELDS),
    value: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.field === 'title') {
      const title = data.value.trim();
      if (title.length < 1) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Title is required' });
      }
    }
    if (data.field === 'dueDate') {
      const trimmed = data.value.trim();
      if (trimmed === '') return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || dueDateFromCalendarDay(trimmed) === null) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: DUE_DATE_MESSAGE });
      }
    }
  });

export type UpdateCardFieldInput = z.infer<typeof updateCardFieldSchema>;
export type UpdateCardFieldErrors = FieldErrors<{ value: string }>;

export const updateCardAssigneesSchema = z.object({
  cardId: idSchema,
  assigneeIds: z.array(idSchema).max(MAX_CARD_ASSIGNEES),
});

export const updateCardLabelSchema = z.object({
  cardId: idSchema,
  labelId: idSchema.optional().nullable(),
});

/**
 * Validates the card fields and returns the first error for each invalid
 * field, ready to render next to its input. An empty object means valid input.
 */
export function validateCard(input: CardInput): CardFieldErrors {
  const result = cardSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
