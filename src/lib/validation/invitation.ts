import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';
import { MEMBERSHIP_ROLE_VALUES } from '@/lib/validation/membership';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@/lib/validation/signUp';

/**
 * Invite payload. A malformed projectId or role is Unauthorized. Username
 * format failures are mapped to the generic "can't invite" message by the
 * action. This schema is not used to return field errors. Role reuses the
 * MEMBER/ADMIN values from membership role changes; OWNER is not invitable.
 */
export const invitationSchema = z.object({
  projectId: idSchema,
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(USERNAME_MIN_LENGTH)
    .max(USERNAME_MAX_LENGTH)
    .regex(USERNAME_PATTERN),
  role: z.enum(MEMBERSHIP_ROLE_VALUES).default('MEMBER'),
});

export type InvitationInput = z.infer<typeof invitationSchema>;

export const acceptInvitationSchema = z.object({
  invitationId: idSchema,
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const rejectInvitationSchema = z.object({
  invitationId: idSchema,
});

export type RejectInvitationInput = z.infer<typeof rejectInvitationSchema>;
