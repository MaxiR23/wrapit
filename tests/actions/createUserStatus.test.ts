// tests/actions/createUserStatus.test.ts
//
// Tests for the createUserStatus server action.
//
// Tested:
// - Creates a custom status with the next tone, default description, and max(order)+1
// - Rejects an empty name before touching Prisma
// - Caps the list at 20 and does not write the 21st
// - Ignores a forged userId
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, validation-before-lookup, cap, ownership, unauthorized, unexpected failure
//
// Run with: pnpm test:run tests/actions/createUserStatus.test.ts
//
// SEE: src/actions/createUserStatus.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
const getSession = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next/cache', () => ({ revalidatePath }));

const { createUserStatus } = await import('@/actions/createUserStatus');
const { MAX_USER_STATUSES, MAX_USER_STATUSES_MESSAGE } = await import('@/lib/userStatus');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

describe('createUserStatus', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a custom status with the next tone and max(order)+1', async () => {
    await db.userStatus.create({
      data: { id: 's0', userId: sessionUser.id, name: 'Active', color: 'green', order: 0 },
    });
    await db.userStatus.create({
      data: { id: 's2', userId: sessionUser.id, name: 'Away', color: 'red', order: 2 },
    });

    const result = await createUserStatus({ name: ' Focus ' });

    expect(result).toEqual({
      data: {
        id: expect.any(String),
        name: 'Focus',
        description: 'Custom status',
        color: 'red',
        order: 3,
      },
    });
    expect(db.userStatus.rows).toHaveLength(3);
    expect(db.userStatus.rows.filter((row) => row.userId === sessionUser.id)).toHaveLength(3);
    expect(revalidatePath).toHaveBeenCalledWith('/account');
  });

  it('rejects an empty name before touching Prisma', async () => {
    const result = await createUserStatus({ name: '   ' });

    expect(result).toEqual({ fieldErrors: { name: expect.any(String) } });
    expect(db.userStatus.create).not.toHaveBeenCalled();
  });

  it('caps the list at 20 and does not write the 21st', async () => {
    for (let order = 0; order < MAX_USER_STATUSES; order += 1) {
      await db.userStatus.create({
        data: {
          id: `s${order}`,
          userId: sessionUser.id,
          name: `S${order}`,
          color: 'green',
          order,
        },
      });
    }

    const result = await createUserStatus({ name: 'Extra' });

    expect(result).toEqual({ fieldErrors: { name: MAX_USER_STATUSES_MESSAGE } });
    expect(db.userStatus.rows).toHaveLength(MAX_USER_STATUSES);
  });

  it('ignores a forged userId and always uses the session user', async () => {
    const result = await createUserStatus({ name: 'Focus', userId: otherUserId } as {
      name: string;
    });

    expect(result).toEqual({
      data: expect.objectContaining({ name: 'Focus', order: 0, color: 'green' }),
    });
    expect(db.userStatus.rows[0]?.userId).toBe(sessionUser.id);
    expect(db.userStatus.rows[0]?.userId).not.toBe(otherUserId);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await createUserStatus({ name: 'Focus' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.userStatus.create).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    db.userStatus.count.mockRejectedValueOnce(new Error('connection refused'));

    const result = await createUserStatus({ name: 'Focus' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});
