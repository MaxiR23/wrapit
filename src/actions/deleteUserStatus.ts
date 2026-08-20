'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { ACCOUNT_PATH } from '@/lib/routes';
import { assertNotLastStatus, LastStatusError, lockUserRow } from '@/lib/userStatus';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { deleteUserStatusSchema, type DeleteUserStatusErrors } from '@/lib/validation/userStatus';

type DeleteUserStatusResult =
  | { data: { id: string; activeStatusId: string } }
  | { fieldErrors: DeleteUserStatusErrors }
  | { error: string };

export async function deleteUserStatus(input: {
  statusId: string;
}): Promise<DeleteUserStatusResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = deleteUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  const { statusId } = parsed.data;
  const userId = session.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { error: 'Unauthorized' as const };
      }

      const target = await tx.userStatus.findFirst({
        where: { id: statusId, userId },
      });
      if (!target) {
        return { error: 'Unauthorized' as const };
      }

      const wasActive = user.activeStatusId === statusId;

      const deleted = await tx.userStatus.deleteMany({
        where: { id: statusId, userId },
      });
      if (deleted.count !== 1) {
        return { error: 'Unauthorized' as const };
      }

      await assertNotLastStatus(tx, userId);

      const remaining = await tx.userStatus.findMany({
        where: { userId },
        orderBy: { order: 'asc' },
      });
      const deletedOrder = typeof target.order === 'number' ? target.order : Number(target.order);
      const previous = [...remaining]
        .reverse()
        .find(
          (row) => (typeof row.order === 'number' ? row.order : Number(row.order)) < deletedOrder,
        );
      const next = previous ?? remaining[0];
      if (!next?.id) {
        throw new LastStatusError();
      }

      if (wasActive) {
        await tx.user.update({
          where: { id: userId },
          data: { activeStatusId: String(next.id) },
        });
      }

      const current = await tx.user.findUnique({ where: { id: userId } });
      const activeStatusId =
        typeof current?.activeStatusId === 'string' ? current.activeStatusId : String(next.id);

      return { data: { id: statusId, activeStatusId } };
    });

    if ('error' in result) {
      return result;
    }

    revalidatePath(ACCOUNT_PATH);
    return result;
  } catch (error) {
    if (error instanceof LastStatusError) {
      return { error: error.message };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
