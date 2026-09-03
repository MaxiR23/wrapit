'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { createCommentSchema, type CreateCommentErrors } from '@/lib/validation/comment';

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

type CreateCommentResult =
  | {
      data: {
        id: string;
        body: string;
        createdAt: Date;
        editedAt: Date | null;
        cardId: string;
        author: { id: string; name: string; username: string };
      };
    }
  | { fieldErrors: CreateCommentErrors }
  | { error: string };

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export async function createComment(input: {
  cardId: string;
  body: string;
}): Promise<CreateCommentResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldFailed = parsed.error.issues.some((issue) => issue.path[0] === 'body');
    if (fieldFailed) {
      return { fieldErrors: firstErrorPerField(parsed.error) as CreateCommentErrors };
    }
    return { error: 'Unauthorized' };
  }

  const owned = await getCardForUser(parsed.data.cardId, session.user.id, 'COMMENT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const claimed = await tx.card.updateMany({
        where: { id: owned.card.id },
        data: { updatedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedWriteError();
      }

      const created = await tx.comment.create({
        data: {
          body: parsed.data.body,
          cardId: owned.card.id,
          authorId: session.user.id,
        },
      });

      await recordActivityEvent(tx, {
        projectId: owned.project.id,
        actorId: session.user.id,
        type: 'COMMENT_ADDED',
        payload: {
          ...activityActorFromSession(session.user),
          cardId: owned.card.id,
          cardTitle: owned.card.title,
          commentId: created.id,
          body: created.body,
        },
      });

      return created;
    });

    revalidatePath(projectPath(owned.project.id));
    return {
      data: {
        id: created.id,
        body: created.body,
        createdAt: created.createdAt,
        editedAt: created.editedAt ?? null,
        cardId: created.cardId,
        author: {
          id: session.user.id,
          name: session.user.name,
          username: sessionUsername(session.user),
        },
      },
    };
  } catch (error) {
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
