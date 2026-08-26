import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';

export const completeCardSchema = z.object({
  cardId: idSchema,
  completed: z.boolean(),
});

export type CompleteCardInput = z.infer<typeof completeCardSchema>;
