'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { boardPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { columnSchema, type ColumnFieldErrors } from '@/lib/validation/column';

type CreateColumnResult =
  | { data: { id: string; title: string; order: number; boardId: string } }
  | { fieldErrors: ColumnFieldErrors }
  | { error: string };

export async function createColumn(input: {
  boardId: string;
  title: string;
}): Promise<CreateColumnResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = columnSchema.safeParse({ title: input.title });
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  const board = await prisma.board.findFirst({
    where: { id: input.boardId, ownerId: session.user.id },
  });
  if (!board) {
    return { error: 'Unauthorized' };
  }

  try {
    const [last] = await prisma.column.findMany({
      where: { boardId: board.id },
      orderBy: { order: 'desc' },
      take: 1,
    });
    const order = (last?.order ?? 0) + 1;

    const column = await prisma.column.create({
      data: {
        title: parsed.data.title,
        order,
        boardId: board.id,
      },
    });

    revalidatePath(boardPath(board.id));

    return { data: column };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
