// tests/lib/notifications.test.ts
//
// Tests for listing and marking notifications for a recipient.
//
// Tested:
// - Paginates the recipient's notifications newest first with an id tiebreak
// - Counts unread rows beyond the loaded page and rejects invalid cursors
// - Counts unread rows for the recipient without loading the list
// - Ignores another user's notifications
// - Marks one of the recipient's rows read and refuses a foreign id
// - Marking an already-read row is an idempotent success
// - Marks all of the recipient's unread rows
//
// What is covered:
// - Happy path, cursor validation, authorization by recipient, mark one / mark all
//
// Run with: pnpm test:run tests/lib/notifications.test.ts
//
// SEE: src/lib/notifications.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const {
  listNotificationsForUser,
  countUnreadNotificationsForUser,
  markNotificationReadForUser,
  markAllNotificationsReadForUser,
} = await import('@/lib/notifications');

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

  it('limits each page, breaks equal timestamps by id, and counts unread rows beyond the page', async () => {
    for (const id of ['a', 'b', 'c']) {
      await db.notification.create({
        data: {
          id,
          type: 'INVITATION_RECEIVED',
          recipientId: maxi.id,
          read: false,
          createdAt: new Date('2026-08-02T00:00:00Z'),
        },
      });
    }

    const first = await listNotificationsForUser(db, maxi.id, undefined, 2);
    expect(first.items.map((item) => item.id)).toEqual(['c', 'b']);
    expect(first).toMatchObject({ hasMore: true, unreadCount: 3 });
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(db.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));

    const second = await listNotificationsForUser(db, maxi.id, first.nextCursor, 2);
    expect(second.items.map((item) => item.id)).toEqual(['a']);
    expect(second).toMatchObject({ hasMore: false, nextCursor: null, unreadCount: 3 });
  });

  it('rejects malformed and tampered page cursors', async () => {
    await expect(listNotificationsForUser(db, maxi.id, 'bad-cursor')).rejects.toThrow(
      'Invalid page cursor',
    );

    for (const id of ['a', 'b']) {
      await db.notification.create({
        data: { id, type: 'INVITATION_RECEIVED', recipientId: maxi.id, read: false },
      });
    }
    const first = await listNotificationsForUser(db, maxi.id, undefined, 1);
    await expect(listNotificationsForUser(db, maxi.id, `${first.nextCursor}x`, 1)).rejects.toThrow(
      'Invalid page cursor',
    );
  });
});

describe('countUnreadNotificationsForUser', () => {
  beforeEach(async () => {
    db.reset();
    await db.user.create({ data: ada });
    await db.user.create({ data: maxi });
  });

  it('counts only the recipient unread rows', async () => {
    await db.notification.create({
      data: { id: 'read', type: 'INVITATION_RECEIVED', read: true, recipientId: maxi.id },
    });
    await db.notification.create({
      data: { id: 'unread', type: 'INVITATION_RECEIVED', read: false, recipientId: maxi.id },
    });
    await db.notification.create({
      data: { id: 'other', type: 'INVITATION_ACCEPTED', read: false, recipientId: ada.id },
    });

    expect(await countUnreadNotificationsForUser(db, maxi.id)).toBe(1);
    expect(await countUnreadNotificationsForUser(db, ada.id)).toBe(1);
    expect(await countUnreadNotificationsForUser(db, 'nobody')).toBe(0);
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

  it('marks notifications that were never loaded in the first page', async () => {
    for (let index = 0; index < 21; index += 1) {
      await db.notification.create({
        data: {
          id: `notification-${index}`,
          type: 'INVITATION_ACCEPTED',
          read: false,
          recipientId: 'user-ada',
        },
      });
    }
    const first = await listNotificationsForUser(db, 'user-ada');
    expect(first.items).toHaveLength(20);
    expect(first.unreadCount).toBe(21);

    await markAllNotificationsReadForUser(db, 'user-ada');
    expect(await countUnreadNotificationsForUser(db, 'user-ada')).toBe(0);
  });
});
