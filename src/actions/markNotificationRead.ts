'use server';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { markNotificationReadForUser, type NotificationDb } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { markNotificationReadSchema } from '@/lib/validation/notification';

type MarkNotificationReadResult = { data: { id: string } } | { error: string };

export async function markNotificationRead(
  notificationId: string,
): Promise<MarkNotificationReadResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = markNotificationReadSchema.safeParse({ notificationId });
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  try {
    const updated = await markNotificationReadForUser(prisma as unknown as NotificationDb, {
      userId: session.user.id,
      notificationId: parsed.data.notificationId,
    });
    if (!updated) {
      return { error: 'Unauthorized' };
    }
    return { data: { id: parsed.data.notificationId } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
