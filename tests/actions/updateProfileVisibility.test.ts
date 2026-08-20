// tests/actions/updateProfileVisibility.test.ts
//
// Tests for the updateProfileVisibility server action.
//
// Tested:
// - Creates a profile row for the session user when none exists
// - Updates visibility on an existing row
// - Persists photo and localTime visibility even though those values are not stored
// - Ignores a forged userId and always uses the session user
// - Rejects an unknown field or visibility
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path create and update, ownership, invalid input, unauthorized,
//   unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/updateProfileVisibility.test.ts
//
// SEE: src/actions/updateProfileVisibility.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
const getSession = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/cache', () => ({
  revalidatePath,
}));

const { updateProfileVisibility } = await import('@/actions/updateProfileVisibility');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

describe('updateProfileVisibility', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a profile row for the signed-in user when none exists', async () => {
    const result = await updateProfileVisibility({ field: 'email', visibility: 'anyone' });

    expect(result).toEqual({ data: { field: 'email', visibility: 'anyone' } });
    expect(db.userProfile.rows).toHaveLength(1);
    expect(db.userProfile.rows[0]).toEqual(
      expect.objectContaining({
        userId: sessionUser.id,
        emailVisibility: 'ANYONE',
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/account');
  });

  it('updates visibility on an existing profile row', async () => {
    await db.userProfile.create({
      data: { userId: sessionUser.id, photoVisibility: 'ANYONE' },
    });

    const result = await updateProfileVisibility({ field: 'photo', visibility: 'team' });

    expect(result).toEqual({ data: { field: 'photo', visibility: 'team' } });
    expect(db.userProfile.rows[0]?.photoVisibility).toBe('TEAM');
  });

  it('persists localTime visibility without a local time value column', async () => {
    const result = await updateProfileVisibility({ field: 'localTime', visibility: 'admins' });

    expect(result).toEqual({ data: { field: 'localTime', visibility: 'admins' } });
    expect(db.userProfile.rows[0]?.localTimeVisibility).toBe('ADMINS_ONLY');
    expect(db.userProfile.rows[0]).not.toHaveProperty('localTime');
  });

  it('ignores a forged userId and always uses the session user', async () => {
    const result = await updateProfileVisibility({
      field: 'pronouns',
      visibility: 'team',
      userId: otherUserId,
    } as { field: string; visibility: string });

    expect(result).toEqual({ data: { field: 'pronouns', visibility: 'team' } });
    expect(db.userProfile.rows[0]?.userId).toBe(sessionUser.id);
    expect(db.userProfile.rows[0]?.userId).not.toBe(otherUserId);
  });

  it('rejects an unknown visibility', async () => {
    const result = await updateProfileVisibility({ field: 'email', visibility: 'secret' });

    expect(result).toEqual({ fieldErrors: { visibility: expect.any(String) } });
    expect(db.userProfile.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await updateProfileVisibility({ field: 'email', visibility: 'anyone' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.userProfile.rows).toHaveLength(0);
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.userProfile.upsert.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await updateProfileVisibility({ field: 'email', visibility: 'anyone' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
  });
});
