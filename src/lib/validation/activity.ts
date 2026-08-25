import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';

export const activityCursorSchema = z.object({
  createdAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime())),
  id: idSchema,
});

export const listActivityEventsSchema = z.object({
  projectId: idSchema,
  cursor: activityCursorSchema.optional(),
});

export const listMyActivityEventsSchema = z.object({
  cursor: activityCursorSchema.optional(),
});

export type ListActivityEventsInput = z.infer<typeof listActivityEventsSchema>;
export type ListMyActivityEventsInput = z.infer<typeof listMyActivityEventsSchema>;
