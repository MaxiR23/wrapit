// tests/actions/listNotifications.test.ts
//
// Tests for listNotifications, markNotificationRead, and markAllNotificationsRead.
//
// Tested:
// - Returns the session user's notifications
// - Rejects when there is no session
// - Marks one owned notification read and refuses a foreign id
// - Rejects an empty, oversized, or non-string notification id without a write
// - Marks all unread for the session user
//
// What is covered:
// - Happy path, unauthorized, mark one / mark all
//
// Run with: pnpm test:run tests/actions/listNotifications.test.ts
//
// SEE: src/actions/listNotifications.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
const getSession = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

const { listNotifications } = await import('@/actions/listNotifications');
const { markNotificationRead } = await import('@/actions/markNotificationRead');
const { markAllNotificationsRead } = await import('@/actions/markAllNotificationsRead');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada Lovelace' };

describe('listNotifications', () => {
  beforeEach(async () => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
    await db.notification.create({
      data: {
        id: 'n1',
        type: 'INVITATION_ACCEPTED',
        message: 'Maxi accepted your invitation to Sprint board',
        read: false,
        recipientId: sessionUser.id,
        createdAt: new Date('2026-08-02T00:00:00Z'),
      },
    });
  });

  it('returns the session user notifications', async () => {
    const result = await listNotifications();

    expect(result).toEqual({
      data: {
        unreadCount: 1,
        items: [
          expect.objectContaining({
            id: 'n1',
            type: 'INVITATION_ACCEPTED',
            read: false,
          }),
        ],
      },
    });
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    expect(await listNotifications()).toEqual({ error: 'Unauthorized' });
  });
});

describe('markNotificationRead', () => {
  beforeEach(async () => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
    await db.notification.create({
      data: {
        id: 'mine',
        type: 'INVITATION_ACCEPTED',
        read: false,
        recipientId: sessionUser.id,
      },
    });
    await db.notification.create({
      data: {
        id: 'theirs',
        type: 'INVITATION_ACCEPTED',
        read: false,
        recipientId: 'user-other',
      },
    });
  });

  it('marks an owned notification read', async () => {
    expect(await markNotificationRead('mine')).toEqual({ data: { id: 'mine' } });
    expect(db.notification.rows.find((row) => row.id === 'mine')?.read).toBe(true);
  });

  it('refuses a notification that belongs to someone else', async () => {
    expect(await markNotificationRead('theirs')).toEqual({ error: 'Unauthorized' });
    expect(db.notification.rows.find((row) => row.id === 'theirs')?.read).toBe(false);
  });

  it('rejects an invalid notification id without a write', async () => {
    db.notification.updateMany.mockClear();

    expect(await markNotificationRead('')).toEqual({ error: 'Unauthorized' });
    expect(await markNotificationRead('   ')).toEqual({ error: 'Unauthorized' });
    expect(await markNotificationRead('a'.repeat(MAX_ID_LENGTH + 1))).toEqual({
      error: 'Unauthorized',
    });
    expect(await markNotificationRead(1 as unknown as string)).toEqual({ error: 'Unauthorized' });
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    expect(db.notification.rows.find((row) => row.id === 'mine')?.read).toBe(false);
  });
});

describe('markAllNotificationsRead', () => {
  beforeEach(async () => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
    await db.notification.create({
      data: { id: 'a', type: 'INVITATION_ACCEPTED', read: false, recipientId: sessionUser.id },
    });
    await db.notification.create({
      data: { id: 'b', type: 'INVITATION_ACCEPTED', read: false, recipientId: 'user-other' },
    });
  });

  it('marks every unread notification for the session user', async () => {
    expect(await markAllNotificationsRead()).toEqual({ data: { ok: true } });
    expect(db.notification.rows.find((row) => row.id === 'a')?.read).toBe(true);
    expect(db.notification.rows.find((row) => row.id === 'b')?.read).toBe(false);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    expect(await markAllNotificationsRead()).toEqual({ error: 'Unauthorized' });
  });
});
