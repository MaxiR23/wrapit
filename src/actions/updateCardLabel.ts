'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { updateCardLabelSchema } from '@/lib/validation/card';

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

type UpdateCardLabelResult = { data: { labelId: string | null } } | { error: string };

export async function updateCardLabel(input: {
  cardId: string;
  labelId?: string | null;
}): Promise<UpdateCardLabelResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateCardLabelSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const owned = await getCardForUser(parsed.data.cardId, session.user.id, 'EDIT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  const labelId = parsed.data.labelId ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      if (labelId) {
        const labelCount = await tx.label.count({
          where: { id: labelId, projectId: owned.project.id },
        });
        if (labelCount !== 1) {
          throw new UnauthorizedWriteError();
        }
      }

      const updated = await tx.card.updateMany({
        where: { id: owned.card.id },
        data: { labelId },
      });
      if (updated.count !== 1) {
        throw new UnauthorizedWriteError();
      }

      let labelName: string | null = null;
      if (labelId) {
        const label = await tx.label.findFirst({
          where: { id: labelId, projectId: owned.project.id },
        });
        labelName = typeof label?.name === 'string' ? label.name : null;
      }

      await recordActivityEvent(tx, {
        projectId: owned.project.id,
        actorId: session.user.id,
        type: 'LABEL_CHANGED',
        payload: {
          ...activityActorFromSession(session.user),
          cardId: owned.card.id,
          cardTitle: owned.card.title,
          labelId,
          labelName,
        },
      });
    });

    revalidatePath(projectPath(owned.project.id));
    return { data: { labelId } };
  } catch (error) {
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
