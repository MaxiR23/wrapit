import { prisma } from '@/lib/prisma';

export type NotificationType =
  'INVITATION_RECEIVED' | 'INVITATION_ACCEPTED' | 'INVITATION_REJECTED';

export type NotificationListItem = {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
  invitationId: string | null;
  actorName: string;
  actorUsername: string;
};

export type NotificationDb = {
  notification: {
    findMany: (args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
    }) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<Record<string, unknown> | null>;
    update: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  invitation: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<Array<Record<string, unknown>>>;
  };
  user: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<Array<Record<string, unknown>>>;
  };
};

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'INVITATION_RECEIVED',
  'INVITATION_ACCEPTED',
  'INVITATION_REJECTED',
];

function asNotificationType(value: unknown): NotificationType {
  if (typeof value === 'string' && NOTIFICATION_TYPES.includes(value as NotificationType)) {
    return value as NotificationType;
  }
  return 'INVITATION_RECEIVED';
}

function actorFor(
  type: NotificationType,
  invitation: Record<string, unknown> | undefined,
  usersById: Map<string, Record<string, unknown>>,
): { actorName: string; actorUsername: string } {
  if (!invitation) return { actorName: '', actorUsername: '' };
  const userId =
    type === 'INVITATION_RECEIVED' ? String(invitation.inviterId) : String(invitation.inviteeId);
  const user = usersById.get(userId);
  return {
    actorName: typeof user?.name === 'string' ? user.name : '',
    actorUsername: typeof user?.username === 'string' ? user.username : '',
  };
}

export async function listNotificationsForUser(
  db: NotificationDb,
  userId: string,
): Promise<{ items: NotificationListItem[]; unreadCount: number }> {
  const rows = await db.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: 'desc' },
  });

  const invitationIds = [
    ...new Set(
      rows.flatMap((row) => (typeof row.invitationId === 'string' ? [row.invitationId] : [])),
    ),
  ];
  const invitations =
    invitationIds.length === 0
      ? []
      : await db.invitation.findMany({ where: { id: { in: invitationIds } } });
  const invitationsById = new Map(
    invitations.map((invitation) => [String(invitation.id), invitation]),
  );

  const userIds = [
    ...new Set(
      invitations.flatMap((invitation) => [
        String(invitation.inviterId),
        String(invitation.inviteeId),
      ]),
    ),
  ];
  const users =
    userIds.length === 0 ? [] : await db.user.findMany({ where: { id: { in: userIds } } });
  const usersById = new Map(users.map((user) => [String(user.id), user]));

  const items = rows.map((row) => {
    const type = asNotificationType(row.type);
    const invitation =
      typeof row.invitationId === 'string' ? invitationsById.get(row.invitationId) : undefined;
    const createdAt =
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? '');
    return {
      id: String(row.id),
      type,
      message: typeof row.message === 'string' ? row.message : '',
      read: row.read === true,
      createdAt,
      invitationId: typeof row.invitationId === 'string' ? row.invitationId : null,
      ...actorFor(type, invitation, usersById),
    };
  });

  return {
    items,
    unreadCount: items.filter((item) => !item.read).length,
  };
}

export async function markNotificationReadForUser(
  db: NotificationDb,
  input: { userId: string; notificationId: string },
): Promise<boolean> {
  const result = await db.notification.updateMany({
    where: { id: input.notificationId, recipientId: input.userId },
    data: { read: true },
  });
  return result.count === 1;
}

export async function markAllNotificationsReadForUser(
  db: NotificationDb,
  userId: string,
): Promise<void> {
  await db.notification.updateMany({
    where: { recipientId: userId, read: false },
    data: { read: true },
  });
}

/** Session-user list for Server Components. Uses the shared Prisma client. */
export function getNotificationsForUser(userId: string) {
  return listNotificationsForUser(prisma as unknown as NotificationDb, userId);
}
