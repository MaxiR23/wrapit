'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { archiveCardSchema } from '@/lib/validation/card';

type ArchiveCardResult = { data: { id: string } } | { error: string };

class OccupancyError extends Error {
  constructor() {
    super('Card occupancy conflict');
    this.name = 'OccupancyError';
  }
}

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
    await prisma.$transaction(async (tx) => {
      const archived = await tx.card.updateMany({
        where: { id: owned.card.id, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      if (archived.count !== 1) {
        throw new OccupancyError();
      }

      await recordActivityEvent(tx, {
        projectId: owned.project.id,
        actorId: session.user.id,
        type: 'CARD_ARCHIVED',
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
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
