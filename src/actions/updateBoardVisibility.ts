'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { PROJECTS_PATH } from '@/lib/routes';
import { toPrismaBoardVisibility } from '@/lib/userPreferences';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import {
  boardVisibilitySchema,
  type BoardVisibilityFieldErrors,
  type BoardVisibilityInput,
} from '@/lib/validation/boardVisibility';

type UpdateBoardVisibilityResult =
  { data: BoardVisibilityInput } | { fieldErrors: BoardVisibilityFieldErrors } | { error: string };

export async function updateBoardVisibility(
  input: BoardVisibilityInput,
): Promise<UpdateBoardVisibilityResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = boardVisibilitySchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  try {
    const visibility = toPrismaBoardVisibility(parsed.data);

    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: visibility,
      create: { userId: session.user.id, ...visibility },
    });

    revalidatePath(PROJECTS_PATH, 'layout');

    return { data: parsed.data };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
