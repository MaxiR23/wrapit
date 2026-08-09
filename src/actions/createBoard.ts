'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { BOARDS_PATH } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { boardSchema, type BoardFieldErrors } from '@/lib/validation/board';

type CreateBoardResult =
  | { data: { id: string; title: string; ownerId: string; createdAt: Date } }
  | { fieldErrors: BoardFieldErrors }
  | { error: string };

export async function createBoard(input: { title: string }): Promise<CreateBoardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = boardSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  try {
    const board = await prisma.board.create({
      data: {
        title: parsed.data.title,
        ownerId: session.user.id,
      },
    });

    revalidatePath(BOARDS_PATH);

    return { data: board };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
