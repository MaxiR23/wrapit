'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { archiveCardSchema } from '@/lib/validation/card';

type ArchiveCardResult = { data: { id: string } } | { error: string };

export async function archiveCard(input: { cardId: string }): Promise<ArchiveCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = archiveCardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const owned = await getCardForUser(parsed.data.cardId, session.user.id, 'EDIT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    const archived = await prisma.card.updateMany({
      where: { id: owned.card.id, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (archived.count !== 1) {
      return { error: 'Unauthorized' };
    }

    revalidatePath(projectPath(owned.project.id));
    return { data: { id: owned.card.id } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
