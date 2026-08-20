import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@/lib/validation/signUp';

/**
 * Invite payload. A malformed projectId is Unauthorized. Username format
 * failures are mapped to the generic "can't invite" message by the action.
 * This schema is not used to return field errors.
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
