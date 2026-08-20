import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';

export const markNotificationReadSchema = z.object({
  notificationId: idSchema,
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;
