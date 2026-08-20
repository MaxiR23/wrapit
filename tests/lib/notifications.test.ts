// tests/lib/notifications.test.ts
//
// Tests for listing and marking notifications for a recipient.
//
// Tested:
// - Lists the recipient's notifications newest first with actor and unread count
// - Ignores another user's notifications
// - Marks one of the recipient's rows read and refuses a foreign id
// - Marking an already-read row is an idempotent success
// - Marks all of the recipient's unread rows
//
// What is covered:
// - Happy path, authorization by recipient, mark one / mark all
//
// Run with: pnpm test:run tests/lib/notifications.test.ts
//
// SEE: src/lib/notifications.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { listNotificationsForUser, markNotificationReadForUser, markAllNotificationsReadForUser } =
  await import('@/lib/notifications');

const ada = { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' };
const maxi = { id: 'user-max', name: 'Maxi', username: 'maxi' };

describe('listNotificationsForUser', () => {
  beforeEach(async () => {
    db.reset();
    await db.user.create({ data: ada });
    await db.user.create({ data: maxi });
    await db.invitation.create({
      data: {
        id: 'invite-1',
        projectId: 'project-1',
        inviterId: ada.id,
        inviteeId: maxi.id,
        status: 'PENDING',
        role: 'MEMBER',
      },
    });
  });

  it('lists the recipient notifications newest first with the inviter as actor', async () => {
    await db.notification.create({
      data: {
        id: 'old',
        type: 'INVITATION_RECEIVED',
        message: 'Ada Lovelace invited you to Sprint board',
        read: true,
        recipientId: maxi.id,
        invitationId: 'invite-1',
        createdAt: new Date('2026-08-01T00:00:00Z'),
      },
    });
    await db.notification.create({
      data: {
        id: 'new',
        type: 'INVITATION_RECEIVED',
        message: 'Ada Lovelace invited you to Sprint board',
        read: false,
        recipientId: maxi.id,
        invitationId: 'invite-1',
        createdAt: new Date('2026-08-02T00:00:00Z'),
      },
    });
    await db.notification.create({
      data: {
        id: 'other',
        type: 'INVITATION_ACCEPTED',
        message: 'Maxi accepted your invitation to Sprint board',
        read: false,
        recipientId: ada.id,
        invitationId: 'invite-1',
      },
    });

    const result = await listNotificationsForUser(db, maxi.id);

    expect(result.unreadCount).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual(['new', 'old']);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        type: 'INVITATION_RECEIVED',
        actorName: 'Ada Lovelace',
        actorUsername: 'ada',
        invitationId: 'invite-1',
        read: false,
      }),
    );
  });
});

describe('markNotificationReadForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('marks the recipient row read and refuses a foreign notification', async () => {
    await db.notification.create({
      data: {
        id: 'mine',
        type: 'INVITATION_ACCEPTED',
        message: 'Maxi accepted',
        read: false,
        recipientId: 'user-ada',
      },
    });
    await db.notification.create({
      data: {
        id: 'theirs',
        type: 'INVITATION_ACCEPTED',
        message: 'Ada accepted',
        read: false,
        recipientId: 'user-max',
      },
    });

    expect(
      await markNotificationReadForUser(db, { userId: 'user-ada', notificationId: 'mine' }),
    ).toBe(true);
    expect(db.notification.rows.find((row) => row.id === 'mine')?.read).toBe(true);

    expect(
      await markNotificationReadForUser(db, { userId: 'user-ada', notificationId: 'theirs' }),
    ).toBe(false);
    expect(db.notification.rows.find((row) => row.id === 'theirs')?.read).toBe(false);
  });

  it('treats marking an already-read notification as success', async () => {
    await db.notification.create({
      data: {
        id: 'mine',
        type: 'INVITATION_ACCEPTED',
        message: 'Maxi accepted',
        read: true,
        recipientId: 'user-ada',
      },
    });

    expect(
      await markNotificationReadForUser(db, { userId: 'user-ada', notificationId: 'mine' }),
    ).toBe(true);
    expect(db.notification.rows.find((row) => row.id === 'mine')?.read).toBe(true);
  });
});

describe('markAllNotificationsReadForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('marks only the recipient unread rows', async () => {
    await db.notification.create({
      data: { id: 'a', type: 'INVITATION_ACCEPTED', read: false, recipientId: 'user-ada' },
    });
    await db.notification.create({
      data: { id: 'b', type: 'INVITATION_REJECTED', read: false, recipientId: 'user-ada' },
    });
    await db.notification.create({
      data: { id: 'c', type: 'INVITATION_ACCEPTED', read: false, recipientId: 'user-max' },
    });

    await markAllNotificationsReadForUser(db, 'user-ada');

    expect(db.notification.rows.find((row) => row.id === 'a')?.read).toBe(true);
    expect(db.notification.rows.find((row) => row.id === 'b')?.read).toBe(true);
    expect(db.notification.rows.find((row) => row.id === 'c')?.read).toBe(false);
  });
});
