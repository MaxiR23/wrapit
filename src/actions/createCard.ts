'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { cardCode } from '@/lib/cardCode';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getColumnForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { createCardSchema, type CardFieldErrors } from '@/lib/validation/card';

type CreateCardResult =
  | {
      data: {
        id: string;
        title: string;
        description: string | null;
        code: string;
        order: number;
        columnId: string;
      };
    }
  | { fieldErrors: CardFieldErrors }
  | { error: string };

export async function createCard(input: {
  columnId: string;
  title: string;
  description?: string;
}): Promise<CreateCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) {
    const fieldFailed = parsed.error.issues.some(
      (issue) => issue.path[0] === 'title' || issue.path[0] === 'description',
    );
    if (fieldFailed) {
      return { fieldErrors: firstErrorPerField(parsed.error) as CardFieldErrors };
    }
    return { error: 'Unauthorized' };
  }

  const owned = await getColumnForUser(parsed.data.columnId, session.user.id);
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    const card = await prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: owned.project.id },
        data: { cardCounter: { increment: 1 } },
        select: { cardCounter: true, title: true },
      });
      const [last] = await tx.card.findMany({
        where: { columnId: owned.column.id },
        orderBy: { order: 'desc' },
        take: 1,
      });
      const order = (last?.order ?? 0) + 1;
      const description = parsed.data.description ? parsed.data.description : null;
      const code = cardCode(project.title, project.cardCounter);

      return tx.card.create({
        data: {
          title: parsed.data.title,
          description,
          code,
          order,
          columnId: owned.column.id,
        },
      });
    });

    revalidatePath(projectPath(owned.project.id));

    return {
      data: {
        id: card.id,
        title: card.title,
        description: card.description,
        code: card.code,
        order: card.order,
        columnId: card.columnId,
      },
    };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
