'use server';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import {
  listNotificationsForUser,
  type NotificationDb,
  type NotificationListItem,
} from '@/lib/notifications';
import { InvalidPageCursorError, type PageResult } from '@/lib/pagination';
import { prisma } from '@/lib/prisma';
import { pageCursorSchema } from '@/lib/validation/pagination';

type ListNotificationsResult =
  { data: PageResult<NotificationListItem> & { unreadCount: number } } | { error: string };

export async function listNotifications(cursor?: string): Promise<ListNotificationsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  if (cursor !== undefined && !pageCursorSchema.safeParse(cursor).success) {
    return { error: 'Unauthorized' };
  }

  try {
    const data = await listNotificationsForUser(
      prisma as unknown as NotificationDb,
      session.user.id,
      cursor,
    );
    return { data };
  } catch (error) {
    if (error instanceof InvalidPageCursorError) return { error: 'Unauthorized' };
    throw error;
  }
}
