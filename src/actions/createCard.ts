'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getColumnForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { boardPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { cardSchema, type CardFieldErrors } from '@/lib/validation/card';

type CreateCardResult =
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

export async function createCard(input: {
  columnId: string;
  title: string;
  description?: string;
}): Promise<CreateCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = cardSchema.safeParse({
    title: input.title,
    description: input.description,
  });
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  const owned = await getColumnForUser(input.columnId, session.user.id);
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    const [last] = await prisma.card.findMany({
      where: { columnId: owned.column.id },
      orderBy: { order: 'desc' },
      take: 1,
    });
    const order = (last?.order ?? 0) + 1;
    const description = parsed.data.description ? parsed.data.description : null;

    const card = await prisma.card.create({
      data: {
        title: parsed.data.title,
        description,
        order,
        columnId: owned.column.id,
      },
    });

    revalidatePath(boardPath(owned.board.id));

    return { data: card };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
