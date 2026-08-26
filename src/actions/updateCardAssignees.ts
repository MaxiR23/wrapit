'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { MY_TASKS_PATH, projectPath } from '@/lib/routes';
import { MAX_CARD_ASSIGNEES, updateCardAssigneesSchema } from '@/lib/validation/card';

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

export type CardAssigneeView = {
  id: string;
  name: string;
  username: string;
};

type UpdateCardAssigneesResult = { data: { assignees: CardAssigneeView[] } } | { error: string };

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export async function updateCardAssignees(input: {
  cardId: string;
  assigneeIds: string[];
}): Promise<UpdateCardAssigneesResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateCardAssigneesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const assigneeIds = uniqueIds(parsed.data.assigneeIds).slice(0, MAX_CARD_ASSIGNEES);

  const owned = await getCardForUser(parsed.data.cardId, session.user.id, 'EDIT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    const assignees = await prisma.$transaction(async (tx) => {
      if (assigneeIds.length > 0) {
        const memberCount = await tx.membership.count({
          where: { projectId: owned.project.id, userId: { in: assigneeIds } },
        });
        if (memberCount !== assigneeIds.length) {
          throw new UnauthorizedWriteError();
        }
      }

      const claimed = await tx.card.updateMany({
        where: { id: owned.card.id },
        data: { updatedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedWriteError();
      }

      await tx.cardAssignee.deleteMany({ where: { cardId: owned.card.id } });
      if (assigneeIds.length > 0) {
        await tx.cardAssignee.createMany({
          data: assigneeIds.map((userId) => ({ cardId: owned.card.id, userId })),
        });
      }

      const users =
        assigneeIds.length === 0
          ? []
          : await tx.user.findMany({
              where: { id: { in: assigneeIds } },
              select: { id: true, name: true, username: true },
            });
      const usersById = new Map(users.map((user) => [user.id, user]));
      const nextAssignees = assigneeIds.map((userId) => {
        const user = usersById.get(userId);
        return {
          id: userId,
          name: user?.name ?? '',
          username: user?.username ?? '',
        };
      });

      await recordActivityEvent(tx, {
        projectId: owned.project.id,
        actorId: session.user.id,
        type: 'ASSIGNEES_CHANGED',
        payload: {
          ...activityActorFromSession(session.user),
          cardId: owned.card.id,
          cardTitle: owned.card.title,
          assignees: nextAssignees,
        },
      });

      return nextAssignees;
    });

    revalidatePath(projectPath(owned.project.id));
    revalidatePath(MY_TASKS_PATH);
    return { data: { assignees } };
  } catch (error) {
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
