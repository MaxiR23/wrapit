'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { boardPath } from '@/lib/routes';

type DeleteCardResult = { data: { id: string } } | { error: string };

export async function deleteCard(input: { cardId: string }): Promise<DeleteCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const owned = await getCardForUser(input.cardId, session.user.id);
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    await prisma.card.delete({ where: { id: owned.card.id } });

    revalidatePath(boardPath(owned.board.id));

    return { data: { id: owned.card.id } };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
