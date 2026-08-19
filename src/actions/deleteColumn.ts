'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { accessibleByUser } from '@/lib/membership';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';

type DeleteColumnResult = { data: { id: string } } | { error: string };

export async function deleteColumn(input: { columnId: string }): Promise<DeleteColumnResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const column = await prisma.column.findFirst({
    where: { id: input.columnId },
  });
  if (!column) {
    return { error: 'Unauthorized' };
  }

  const project = await prisma.project.findFirst({
    where: { id: column.projectId, ...accessibleByUser(session.user.id) },
  });
  if (!project) {
    return { error: 'Unauthorized' };
  }

  try {
    await prisma.column.delete({ where: { id: column.id } });

    revalidatePath(projectPath(project.id));

    return { data: { id: column.id } };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
