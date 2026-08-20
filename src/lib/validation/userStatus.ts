import { z } from 'zod';

import { USER_STATUS_TONES } from '@/lib/userStatus';
import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';
import { idSchema } from '@/lib/validation/id';

export const MAX_USER_STATUS_FIELD_LENGTH = 200;

export const USER_STATUS_FIELDS = ['name', 'description', 'color'] as const;

export const setActiveStatusSchema = z.object({
  statusId: idSchema,
});

export type SetActiveStatusInput = z.infer<typeof setActiveStatusSchema>;
export type SetActiveStatusErrors = FieldErrors<SetActiveStatusInput>;

export const deleteUserStatusSchema = z.object({
  statusId: idSchema,
});

export type DeleteUserStatusInput = z.infer<typeof deleteUserStatusSchema>;
export type DeleteUserStatusErrors = FieldErrors<DeleteUserStatusInput>;

export const createUserStatusSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(MAX_USER_STATUS_FIELD_LENGTH),
});

export type CreateUserStatusInput = z.infer<typeof createUserStatusSchema>;
export type CreateUserStatusErrors = FieldErrors<CreateUserStatusInput>;

export const updateUserStatusFieldSchema = z
  .object({
    statusId: idSchema,
    field: z.enum(USER_STATUS_FIELDS),
    value: z.string().trim().max(MAX_USER_STATUS_FIELD_LENGTH),
  })
  .superRefine((data, ctx) => {
    if (data.field === 'name' && data.value.length < 1) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Name is required' });
    }
    if (data.field === 'color' && !(USER_STATUS_TONES as readonly string[]).includes(data.value)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Invalid color' });
    }
  });

export type UpdateUserStatusFieldInput = z.infer<typeof updateUserStatusFieldSchema>;
export type UpdateUserStatusFieldErrors = FieldErrors<UpdateUserStatusFieldInput>;

export function validateSetActiveStatus(input: SetActiveStatusInput): SetActiveStatusErrors {
  const result = setActiveStatusSchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}

export function validateDeleteUserStatus(input: DeleteUserStatusInput): DeleteUserStatusErrors {
  const result = deleteUserStatusSchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}

export function validateCreateUserStatus(input: CreateUserStatusInput): CreateUserStatusErrors {
  const result = createUserStatusSchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}

export function validateUpdateUserStatusField(
  input: UpdateUserStatusFieldInput,
): UpdateUserStatusFieldErrors {
  const result = updateUserStatusFieldSchema.safeParse(input);
  if (result.success) return {};
  return firstErrorPerField(result.error);
}
