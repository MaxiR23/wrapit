'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { PROJECTS_PATH } from '@/lib/routes';
import { toPrismaViewMode } from '@/lib/userPreferences';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { viewModeSchema, type ViewModeFieldErrors } from '@/lib/validation/viewMode';

type UpdateViewModeResult =
  | { data: { viewMode: 'grid' | 'list' } }
  | { fieldErrors: ViewModeFieldErrors }
  | { error: string };

export async function updateViewMode(input: {
  viewMode: 'grid' | 'list';
}): Promise<UpdateViewModeResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = viewModeSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  try {
    const viewMode = toPrismaViewMode(parsed.data.viewMode);

    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: { viewMode },
      create: { userId: session.user.id, viewMode },
    });

    revalidatePath(PROJECTS_PATH);

    return { data: { viewMode: parsed.data.viewMode } };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
