'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { ACCOUNT_PATH } from '@/lib/routes';
import { profileVisibilityColumn, toPrismaProfileVisibility } from '@/lib/userProfile';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import {
  updateProfileVisibilitySchema,
  type UpdateProfileVisibilityErrors,
} from '@/lib/validation/userProfile';

type UpdateProfileVisibilityResult =
  | { data: { field: string; visibility: string } }
  | { fieldErrors: UpdateProfileVisibilityErrors }
  | { error: string };

export async function updateProfileVisibility(input: {
  field: string;
  visibility: string;
}): Promise<UpdateProfileVisibilityResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateProfileVisibilitySchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  const { field, visibility } = parsed.data;
  const column = profileVisibilityColumn(field);
  const prismaVisibility = toPrismaProfileVisibility(visibility);

  try {
    await prisma.userProfile.upsert({
      where: { userId: session.user.id },
      update: { [column]: prismaVisibility },
      create: { userId: session.user.id, [column]: prismaVisibility },
    });

    revalidatePath(ACCOUNT_PATH);
    return { data: { field, visibility } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
