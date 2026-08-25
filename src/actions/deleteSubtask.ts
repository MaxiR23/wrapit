'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getSubtaskForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { deleteSubtaskSchema } from '@/lib/validation/subtask';

type DeleteSubtaskResult = { data: { id: string } } | { error: string };

export async function deleteSubtask(input: { subtaskId: string }): Promise<DeleteSubtaskResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = deleteSubtaskSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const owned = await getSubtaskForUser(parsed.data.subtaskId, session.user.id);
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    const deleted = await prisma.subtask.deleteMany({
      where: { id: owned.subtask.id, cardId: owned.card.id },
    });
    if (deleted.count !== 1) {
      return { error: 'Unauthorized' };
    }

    revalidatePath(projectPath(owned.project.id));
    return { data: { id: owned.subtask.id } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
