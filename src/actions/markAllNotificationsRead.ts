'use server';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { markAllNotificationsReadForUser, type NotificationDb } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

type MarkAllNotificationsReadResult = { data: { ok: true } } | { error: string };

export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  try {
    await markAllNotificationsReadForUser(prisma as unknown as NotificationDb, session.user.id);
    return { data: { ok: true } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
