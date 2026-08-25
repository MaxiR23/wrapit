import { z } from 'zod';

import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';
import { idSchema } from '@/lib/validation/id';

export const MAX_COMMENT_BODY_LENGTH = 4000;

export const createCommentSchema = z.object({
  cardId: idSchema,
  body: z.string().trim().min(1, 'Comment is required').max(MAX_COMMENT_BODY_LENGTH),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateCommentErrors = FieldErrors<CreateCommentInput>;

export function validateCreateComment(input: CreateCommentInput): CreateCommentErrors {
  const result = createCommentSchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}
