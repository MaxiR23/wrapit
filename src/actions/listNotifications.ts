'use server';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import {
  listNotificationsForUser,
  type NotificationDb,
  type NotificationListItem,
} from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

type ListNotificationsResult =
  { data: { items: NotificationListItem[]; unreadCount: number } } | { error: string };

export async function listNotifications(): Promise<ListNotificationsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const data = await listNotificationsForUser(prisma as unknown as NotificationDb, session.user.id);
  return { data };
}
