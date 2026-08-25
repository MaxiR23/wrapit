'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { deleteCardSchema } from '@/lib/validation/card';

type DeleteCardResult = { data: { id: string } } | { error: string };

class OccupancyError extends Error {
  constructor() {
    super('Card occupancy conflict');
    this.name = 'OccupancyError';
  }
}

export async function deleteCard(input: { cardId: string }): Promise<DeleteCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = deleteCardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const owned = await getCardForUser(parsed.data.cardId, session.user.id, 'EDIT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.card.deleteMany({ where: { id: owned.card.id } });
      if (deleted.count !== 1) {
        throw new OccupancyError();
      }

      await recordActivityEvent(tx, {
        projectId: owned.project.id,
        actorId: session.user.id,
        type: 'CARD_DELETED',
        payload: {
          ...activityActorFromSession(session.user),
          cardId: owned.card.id,
          cardTitle: owned.card.title,
        },
      });
    });

    revalidatePath(projectPath(owned.project.id));

    return { data: { id: owned.card.id } };
  } catch (error) {
    if (error instanceof OccupancyError) {
      return { error: 'Unauthorized' };
    }
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
