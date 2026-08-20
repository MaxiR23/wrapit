import { z } from 'zod';

import {
  PROFILE_VALUE_FIELDS,
  PROFILE_VISIBILITY_FIELDS,
  PROFILE_VISIBILITY_VALUES,
} from '@/lib/userProfile';
import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';

export const MAX_PROFILE_FIELD_LENGTH = 200;
export const MAX_WORKING_WITH_YOU_LENGTH = 280;

export const updateProfileFieldSchema = z
  .object({
    field: z.enum(PROFILE_VALUE_FIELDS),
    value: z.string().trim().max(MAX_WORKING_WITH_YOU_LENGTH),
  })
  .superRefine((data, ctx) => {
    if (data.field === 'publicName' && data.value.length < 1) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Name is required' });
    }
    if (data.field !== 'workingWithYou' && data.value.length > MAX_PROFILE_FIELD_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `Must be at most ${MAX_PROFILE_FIELD_LENGTH} characters`,
      });
    }
  });

export type UpdateProfileFieldInput = z.infer<typeof updateProfileFieldSchema>;

export type UpdateProfileFieldErrors = FieldErrors<UpdateProfileFieldInput>;

export const updateProfileVisibilitySchema = z.object({
  field: z.enum(PROFILE_VISIBILITY_FIELDS),
  visibility: z.enum(PROFILE_VISIBILITY_VALUES),
});

export type UpdateProfileVisibilityInput = z.infer<typeof updateProfileVisibilitySchema>;

export type UpdateProfileVisibilityErrors = FieldErrors<UpdateProfileVisibilityInput>;

export function validateUpdateProfileField(
  input: UpdateProfileFieldInput,
): UpdateProfileFieldErrors {
  const result = updateProfileFieldSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}

export function validateUpdateProfileVisibility(
  input: UpdateProfileVisibilityInput,
): UpdateProfileVisibilityErrors {
  const result = updateProfileVisibilitySchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
