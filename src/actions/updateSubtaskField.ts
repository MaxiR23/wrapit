'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getSubtaskForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { updateSubtaskFieldSchema, type UpdateSubtaskFieldErrors } from '@/lib/validation/subtask';

type UpdateSubtaskFieldResult =
  | { data: { value: string | boolean } }
  | { fieldErrors: UpdateSubtaskFieldErrors }
  | { error: string };

export async function updateSubtaskField(input: {
  subtaskId: string;
  field: string;
  value: string | boolean;
}): Promise<UpdateSubtaskFieldResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateSubtaskFieldSchema.safeParse(input);
  if (!parsed.success) {
    const fieldFailed = parsed.error.issues.some(
      (issue) => issue.path[0] === 'value' || issue.path[0] === 'field',
    );
    if (fieldFailed) {
      return { fieldErrors: firstErrorPerField(parsed.error) as UpdateSubtaskFieldErrors };
    }
    return { error: 'Unauthorized' };
  }

  const owned = await getSubtaskForUser(parsed.data.subtaskId, session.user.id);
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    if (parsed.data.field === 'text') {
      const updated = await prisma.subtask.updateMany({
        where: { id: owned.subtask.id, cardId: owned.card.id },
        data: { text: parsed.data.value },
      });
      if (updated.count !== 1) {
        return { error: 'Unauthorized' };
      }
      revalidatePath(projectPath(owned.project.id));
      return { data: { value: parsed.data.value } };
    }

    const updated = await prisma.subtask.updateMany({
      where: { id: owned.subtask.id, cardId: owned.card.id },
      data: { done: parsed.data.value },
    });
    if (updated.count !== 1) {
      return { error: 'Unauthorized' };
    }
    revalidatePath(projectPath(owned.project.id));
    return { data: { value: parsed.data.value } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
