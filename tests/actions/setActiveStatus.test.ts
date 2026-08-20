// tests/actions/setActiveStatus.test.ts
//
// Tests for the setActiveStatus server action.
//
// Tested:
// - Points the session user's activeStatusId at an owned status
// - Rejects a status that belongs to another user
// - Rejects an invalid id before touching Prisma
// - Ignores a forged userId
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, ownership, validation-before-lookup, unauthorized, unexpected failure
//
// Run with: pnpm test:run tests/actions/setActiveStatus.test.ts
//
// SEE: src/actions/setActiveStatus.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
const getSession = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next/cache', () => ({ revalidatePath }));

const { setActiveStatus } = await import('@/actions/setActiveStatus');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

describe('setActiveStatus', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('points activeStatusId at an owned status', async () => {
    await db.user.create({ data: { ...sessionUser, activeStatusId: 'status-a' } });
    await db.userStatus.create({
      data: { id: 'status-a', userId: sessionUser.id, name: 'Active', order: 0, color: 'green' },
    });
    await db.userStatus.create({
      data: { id: 'status-b', userId: sessionUser.id, name: 'Inactive', order: 1, color: 'gray' },
    });

    const result = await setActiveStatus({ statusId: 'status-b' });

    expect(result).toEqual({ data: { activeStatusId: 'status-b' } });
    expect(db.user.rows[0]?.activeStatusId).toBe('status-b');
    expect(revalidatePath).toHaveBeenCalledWith('/account');
  });

  it('rejects a status that belongs to another user', async () => {
    await db.user.create({ data: { ...sessionUser, activeStatusId: 'status-a' } });
    await db.userStatus.create({
      data: { id: 'status-a', userId: sessionUser.id, name: 'Active', order: 0, color: 'green' },
    });
    await db.userStatus.create({
      data: { id: 'status-other', userId: otherUserId, name: 'Active', order: 0, color: 'green' },
    });

    const result = await setActiveStatus({ statusId: 'status-other' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.user.rows[0]?.activeStatusId).toBe('status-a');
  });

  it('rejects an invalid id before touching Prisma', async () => {
    const result = await setActiveStatus({ statusId: 'a'.repeat(MAX_ID_LENGTH + 1) });

    expect(result).toEqual({ fieldErrors: { statusId: expect.any(String) } });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('ignores a forged userId and always uses the session user', async () => {
    await db.user.create({ data: { ...sessionUser, activeStatusId: 'status-a' } });
    await db.user.create({ data: { id: otherUserId, email: 'o@x.com', name: 'Other' } });
    await db.userStatus.create({
      data: { id: 'status-a', userId: sessionUser.id, name: 'Active', order: 0, color: 'green' },
    });
    await db.userStatus.create({
      data: { id: 'status-b', userId: sessionUser.id, name: 'Inactive', order: 1, color: 'gray' },
    });

    const result = await setActiveStatus({
      statusId: 'status-b',
      userId: otherUserId,
    } as { statusId: string });

    expect(result).toEqual({ data: { activeStatusId: 'status-b' } });
    expect(db.user.rows[0]?.activeStatusId).toBe('status-b');
    expect(db.user.rows[1]?.activeStatusId).toBeUndefined();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await setActiveStatus({ statusId: 'status-a' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    await db.user.create({ data: sessionUser });
    db.user.updateMany.mockRejectedValueOnce(new Error('connection to 10.0.0.5 refused'));

    const result = await setActiveStatus({ statusId: 'status-a' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});
