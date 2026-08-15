'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { upsertOwnerMembershipStarred } from '@/lib/membership';
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

    if (membership) {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { starred },
      });
      revalidatePath(PROJECTS_PATH);
      return { data: { starred } };
    }

    const owned = await prisma.project.findFirst({
      where: { id: projectId, ownerId: session.user.id },
    });
    if (!owned) {
      return { error: 'Unauthorized' };
    }

    await upsertOwnerMembershipStarred(prisma, session.user.id, owned.id, starred);
    revalidatePath(PROJECTS_PATH);
    return { data: { starred } };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
