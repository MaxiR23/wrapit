import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';

export const BOARD_ACCESS_VALUES = ['EDIT', 'COMMENT', 'VIEW'] as const;

export const updateMembershipAccessSchema = z.object({
  projectId: idSchema,
  membershipId: idSchema,
  access: z.enum(BOARD_ACCESS_VALUES),
});

export type UpdateMembershipAccessInput = z.infer<typeof updateMembershipAccessSchema>;

export const removeMemberSchema = z.object({
  projectId: idSchema,
  membershipId: idSchema,
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export const updatePublicLinkSchema = z.object({
  projectId: idSchema,
  enabled: z.boolean(),
});

export type UpdatePublicLinkInput = z.infer<typeof updatePublicLinkSchema>;
