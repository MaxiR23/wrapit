'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { labelToneForIndex } from '@/lib/labelTones';
import {
  labelFromRow,
  lockProjectRow,
  MaxLabelsError,
  MAX_PROJECT_LABELS,
  nextLabelName,
  type LabelView,
} from '@/lib/labels';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { seedProjectLabelsIfEmpty } from '@/lib/projectLabels';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { createLabelSchema, type CreateLabelErrors } from '@/lib/validation/label';

type CreateLabelResult =
  { data: LabelView } | { fieldErrors: CreateLabelErrors } | { error: string };

export async function createLabel(input: { projectId: string }): Promise<CreateLabelResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = createLabelSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  const { projectId } = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      await lockProjectRow(tx, projectId);

      const project = await tx.project.findFirst({
        where: { id: projectId, memberships: { some: { userId: session.user.id } } },
      });
      if (!project) {
        return { error: 'Unauthorized' as const };
      }

      const labels = await seedProjectLabelsIfEmpty(tx, projectId);
      if (labels.length >= MAX_PROJECT_LABELS) {
        throw new MaxLabelsError();
      }

      const latest = await tx.label.findMany({
        where: { projectId },
        orderBy: { order: 'desc' },
        take: 1,
      });
      const order = typeof latest[0]?.order === 'number' ? latest[0].order + 1 : 0;

      return tx.label.create({
        data: {
          projectId,
          name: nextLabelName(labels.length),
          tone: labelToneForIndex(labels.length),
          order,
        },
      });
    });

    if (created && 'error' in created) {
      return created;
    }

    revalidatePath(projectPath(projectId));
    return { data: labelFromRow(created) };
  } catch (error) {
    if (error instanceof MaxLabelsError) {
      return { error: error.message };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
