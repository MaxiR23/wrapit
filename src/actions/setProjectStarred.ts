'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { PROJECTS_PATH } from '@/lib/routes';

type SetProjectStarredResult = { data: { starred: boolean } } | { error: string };

export async function setProjectStarred(
  projectId: string,
  starred: boolean,
): Promise<SetProjectStarredResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return { error: 'Unauthorized' };
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, projectId },
    });
    if (!membership) {
      return { error: 'Unauthorized' };
    }

    await prisma.membership.update({
      where: { id: membership.id },
      data: { starred },
    });
    revalidatePath(PROJECTS_PATH);
    return { data: { starred } };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
