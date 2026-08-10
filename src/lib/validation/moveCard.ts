import { z } from 'zod';

import type { FieldErrors } from '@/lib/validation/fieldErrors';

export const moveCardSchema = z.object({
  cardId: z.string().trim().min(1, 'Card is required'),
  targetColumnId: z.string().trim().min(1, 'Column is required'),
  beforeCardId: z.string().trim().min(1).nullable(),
  afterCardId: z.string().trim().min(1).nullable(),
});

export type MoveCardInput = z.infer<typeof moveCardSchema>;

export type MoveCardFieldErrors = FieldErrors<MoveCardInput>;
