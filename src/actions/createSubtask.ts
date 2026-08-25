'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { createSubtaskSchema, type CreateSubtaskErrors } from '@/lib/validation/subtask';

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

type CreateSubtaskResult =
  | { data: { id: string; text: string; done: boolean; order: number; cardId: string } }
  | { fieldErrors: CreateSubtaskErrors }
  | { error: string };

export async function createSubtask(input: {
  cardId: string;
  text: string;
}): Promise<CreateSubtaskResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = createSubtaskSchema.safeParse(input);
  if (!parsed.success) {
    const fieldFailed = parsed.error.issues.some((issue) => issue.path[0] === 'text');
    if (fieldFailed) {
      return { fieldErrors: firstErrorPerField(parsed.error) as CreateSubtaskErrors };
    }
    return { error: 'Unauthorized' };
  }

  const owned = await getCardForUser(parsed.data.cardId, session.user.id);
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

      const [last] = await tx.subtask.findMany({
        where: { cardId: owned.card.id },
        orderBy: { order: 'desc' },
        take: 1,
      });
      const order = (typeof last?.order === 'number' ? last.order : 0) + 1;

      return tx.subtask.create({
        data: {
          text: parsed.data.text,
          done: false,
          order,
          cardId: owned.card.id,
        },
      });
    });

    revalidatePath(projectPath(owned.project.id));
    return {
      data: {
        id: created.id,
        text: created.text,
        done: created.done,
        order: created.order,
        cardId: created.cardId,
      },
    };
  } catch (error) {
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
