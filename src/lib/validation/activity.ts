import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';
import { pageCursorSchema } from '@/lib/validation/pagination';

export const listActivityEventsSchema = z.object({
  projectId: idSchema,
  cursor: pageCursorSchema.optional(),
});

export const listMyActivityEventsSchema = z.object({
  cursor: pageCursorSchema.optional(),
});

export type ListActivityEventsInput = z.infer<typeof listActivityEventsSchema>;
export type ListMyActivityEventsInput = z.infer<typeof listMyActivityEventsSchema>;
