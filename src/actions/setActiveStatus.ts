'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { ACCOUNT_PATH } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { setActiveStatusSchema, type SetActiveStatusErrors } from '@/lib/validation/userStatus';

type SetActiveStatusResult =
  { data: { activeStatusId: string } } | { fieldErrors: SetActiveStatusErrors } | { error: string };

export async function setActiveStatus(input: { statusId: string }): Promise<SetActiveStatusResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = setActiveStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  try {
    const updated = await prisma.user.updateMany({
      where: {
        id: session.user.id,
        statuses: { some: { id: parsed.data.statusId } },
      },
      data: { activeStatusId: parsed.data.statusId },
    });
    if (updated.count !== 1) {
      return { error: 'Unauthorized' };
    }

    revalidatePath(ACCOUNT_PATH);
    return { data: { activeStatusId: parsed.data.statusId } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
