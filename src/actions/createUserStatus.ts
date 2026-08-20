'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { ACCOUNT_PATH } from '@/lib/routes';
import {
  DEFAULT_CUSTOM_STATUS_DESCRIPTION,
  MaxStatusesError,
  MAX_USER_STATUSES,
  statusFromRow,
  userStatusToneForIndex,
  type UserStatusView,
} from '@/lib/userStatus';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { createUserStatusSchema, type CreateUserStatusErrors } from '@/lib/validation/userStatus';

type CreateUserStatusResult =
  { data: UserStatusView } | { fieldErrors: CreateUserStatusErrors } | { error: string };

export async function createUserStatus(input: { name: string }): Promise<CreateUserStatusResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = createUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.userStatus.count({ where: { userId: session.user.id } });
      if (count >= MAX_USER_STATUSES) {
        throw new MaxStatusesError();
      }

      const latest = await tx.userStatus.findMany({
        where: { userId: session.user.id },
        orderBy: { order: 'desc' },
        take: 1,
      });
      const order = typeof latest[0]?.order === 'number' ? latest[0].order + 1 : 0;

      return tx.userStatus.create({
        data: {
          userId: session.user.id,
          name: parsed.data.name,
          description: DEFAULT_CUSTOM_STATUS_DESCRIPTION,
          color: userStatusToneForIndex(count),
          order,
        },
      });
    });

    revalidatePath(ACCOUNT_PATH);
    return { data: statusFromRow(created) };
  } catch (error) {
    if (error instanceof MaxStatusesError) {
      return { fieldErrors: { name: error.message } };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
