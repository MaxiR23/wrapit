import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';

export const recordRecentProjectSchema = z.object({
  projectId: idSchema,
});

export const setProjectStarredSchema = z.object({
  projectId: idSchema,
  starred: z.boolean(),
});
