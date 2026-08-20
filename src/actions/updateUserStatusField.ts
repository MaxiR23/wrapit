'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { ACCOUNT_PATH } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import {
  updateUserStatusFieldSchema,
  type UpdateUserStatusFieldErrors,
} from '@/lib/validation/userStatus';

type UpdateUserStatusFieldResult =
  { data: { value: string } } | { fieldErrors: UpdateUserStatusFieldErrors } | { error: string };

export async function updateUserStatusField(input: {
  statusId: string;
  field: string;
  value: string;
}): Promise<UpdateUserStatusFieldResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateUserStatusFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  const { statusId, field, value } = parsed.data;

  try {
    const updated = await prisma.userStatus.updateMany({
      where: { id: statusId, userId: session.user.id },
      data: { [field]: value },
    });
    if (updated.count !== 1) {
      return { error: 'Unauthorized' };
    }

    revalidatePath(ACCOUNT_PATH);
    return { data: { value } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
