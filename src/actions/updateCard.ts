'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { updateCardSchema, type CardFieldErrors } from '@/lib/validation/card';

type UpdateCardResult =
  | {
      data: {
        id: string;
        title: string;
        description: string | null;
        order: number;
        columnId: string;
      };
    }
  | { fieldErrors: CardFieldErrors }
  | { error: string };

export async function updateCard(input: {
  cardId: string;
  title: string;
  description?: string;
}): Promise<UpdateCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) {
    const fieldFailed = parsed.error.issues.some(
      (issue) => issue.path[0] === 'title' || issue.path[0] === 'description',
    );
    if (fieldFailed) {
      return { fieldErrors: firstErrorPerField(parsed.error) as CardFieldErrors };
    }
    return { error: 'Unauthorized' };
  }

  const owned = await getCardForUser(parsed.data.cardId, session.user.id, 'EDIT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    const description = parsed.data.description ? parsed.data.description : null;

    const card = await prisma.card.update({
      where: { id: owned.card.id },
      data: {
        title: parsed.data.title,
        description,
      },
    });

    revalidatePath(projectPath(owned.project.id));

    return { data: card };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
