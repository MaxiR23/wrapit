'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { assertNotLastLabel, LastLabelError, lockProjectRow } from '@/lib/labels';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getLabelForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { deleteLabelSchema, type DeleteLabelErrors } from '@/lib/validation/label';

type DeleteLabelResult =
  | { data: { id: string; replacementId: string } }
  | { fieldErrors: DeleteLabelErrors }
  | { error: string };

export async function deleteLabel(input: { labelId: string }): Promise<DeleteLabelResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = deleteLabelSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  const { labelId } = parsed.data;

  try {
    const owned = await getLabelForUser(labelId, session.user.id, 'EDIT');
    if (!owned) {
      return { error: 'Unauthorized' };
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockProjectRow(tx, owned.project.id);

      const sibling = await tx.label.findFirst({
        where: { projectId: owned.project.id, id: { not: labelId } },
        orderBy: { order: 'asc' },
      });

      if (sibling?.id) {
        await tx.card.updateMany({
          where: { labelId },
          data: { labelId: String(sibling.id) },
        });
      }

      const deleted = await tx.label.deleteMany({
        where: { id: labelId, projectId: owned.project.id },
      });
      if (deleted.count !== 1) {
        return { error: 'Unauthorized' as const };
      }

      await assertNotLastLabel(tx, owned.project.id);

      const replacementId = sibling?.id ? String(sibling.id) : '';
      if (!replacementId) {
        throw new LastLabelError();
      }

      return { data: { id: labelId, replacementId } };
    });

    if ('error' in result) {
      return result;
    }

    revalidatePath(projectPath(owned.project.id));
    return result;
  } catch (error) {
    if (error instanceof LastLabelError) {
      return { error: error.message };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
