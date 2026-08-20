import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';
import { idSchema } from '@/lib/validation/id';

export const cardSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
});

export type CardInput = z.infer<typeof cardSchema>;

export type CardFieldErrors = FieldErrors<CardInput>;

export const createCardSchema = cardSchema.extend({
  columnId: idSchema,
});

export const updateCardSchema = cardSchema.extend({
  cardId: idSchema,
});

export const deleteCardSchema = z.object({
  cardId: idSchema,
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
