'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { ACCOUNT_PATH, PROJECTS_PATH } from '@/lib/routes';
import { profileValueColumn } from '@/lib/userProfile';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import {
  updateProfileFieldSchema,
  type UpdateProfileFieldErrors,
} from '@/lib/validation/userProfile';

type UpdateProfileFieldResult =
  | { data: { field: string; value: string } }
  | { fieldErrors: UpdateProfileFieldErrors }
  | { error: string };

export async function updateProfileField(input: {
  field: string;
  value: string;
}): Promise<UpdateProfileFieldResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateProfileFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  const { field, value } = parsed.data;

  try {
    if (field === 'publicName') {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name: value },
      });
      revalidatePath(ACCOUNT_PATH);
      revalidatePath(PROJECTS_PATH);
      return { data: { field, value } };
    }

    const column = profileValueColumn(field);
    await prisma.userProfile.upsert({
      where: { userId: session.user.id },
      update: { [column]: value },
      create: { userId: session.user.id, [column]: value },
    });

    revalidatePath(ACCOUNT_PATH);
    return { data: { field, value } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
