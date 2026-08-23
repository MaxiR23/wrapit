'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getLabelForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { updateLabelFieldSchema, type UpdateLabelFieldErrors } from '@/lib/validation/label';

type UpdateLabelFieldResult =
  { data: { value: string } } | { fieldErrors: UpdateLabelFieldErrors } | { error: string };

export async function updateLabelField(input: {
  labelId: string;
  field: string;
  value: string;
}): Promise<UpdateLabelFieldResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateLabelFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  const { labelId, field, value } = parsed.data;

  try {
    const owned = await getLabelForUser(labelId, session.user.id);
    if (!owned) {
      return { error: 'Unauthorized' };
    }

    const updated = await prisma.label.updateMany({
      where: { id: labelId, projectId: owned.project.id },
      data: { [field]: value },
    });
    if (updated.count !== 1) {
      return { error: 'Unauthorized' };
    }

    revalidatePath(projectPath(owned.project.id));
    return { data: { value } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
