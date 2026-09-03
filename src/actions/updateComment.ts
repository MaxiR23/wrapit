'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { COMMENT_CHANGED_ELSEWHERE_MESSAGE, GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCommentForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { updateCommentSchema, type UpdateCommentErrors } from '@/lib/validation/comment';

type UpdateCommentResult =
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
  | { fieldErrors: UpdateCommentErrors }
  | { error: string };

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export async function updateComment(input: {
  commentId: string;
  body: string;
}): Promise<UpdateCommentResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }
  const user = session.user;

  const parsed = updateCommentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldFailed = parsed.error.issues.some((issue) => issue.path[0] === 'body');
    if (fieldFailed) {
      return { fieldErrors: firstErrorPerField(parsed.error) as UpdateCommentErrors };
    }
    return { error: 'Unauthorized' };
  }

  const owned = await getCommentForUser(parsed.data.commentId, user.id, 'COMMENT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  if (owned.comment.authorId !== user.id) {
    return { error: 'Unauthorized' };
  }

  function commentData(comment: {
    id: string;
    body: string;
    createdAt: Date;
    editedAt: Date | null;
    cardId: string;
  }) {
    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt ?? null,
      cardId: comment.cardId,
      author: {
        id: user.id,
        name: user.name,
        username: sessionUsername(user),
      },
    };
  }

  if (parsed.data.body === owned.comment.body) {
    return { data: commentData(owned.comment) };
  }

  try {
    const editedAt = new Date();
    const updated = await prisma.comment.updateMany({
      where: {
        id: owned.comment.id,
        authorId: user.id,
        body: owned.comment.body,
      },
      data: {
        body: parsed.data.body,
        editedAt,
      },
    });
    if (updated.count !== 1) {
      return { error: COMMENT_CHANGED_ELSEWHERE_MESSAGE };
    }
    revalidatePath(projectPath(owned.project.id));
    return {
      data: commentData({
        ...owned.comment,
        body: parsed.data.body,
        editedAt,
      }),
    };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
