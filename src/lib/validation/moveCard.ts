import { z } from 'zod';

import type { FieldErrors } from '@/lib/validation/fieldErrors';
import { idSchema } from '@/lib/validation/id';

export const moveCardSchema = z.object({
  cardId: idSchema,
  targetColumnId: idSchema,
  beforeCardId: idSchema.nullable(),
  afterCardId: idSchema.nullable(),
});

export type MoveCardInput = z.infer<typeof moveCardSchema>;

export type MoveCardFieldErrors = FieldErrors<MoveCardInput>;
