// tests/actions/updateProfileField.test.ts
//
// Tests for the updateProfileField server action.
//
// Tested:
// - Creates a profile row for the session user when none exists
// - Updates a field on an existing row
// - Writes public name to User.name
// - Returns and stores the trimmed value
// - Ignores a forged userId and always uses the session user
// - Rejects an empty public name and an unknown field
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path create and update, public name, ownership, invalid input,
//   unauthorized, unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/updateProfileField.test.ts
//
// SEE: src/actions/updateProfileField.ts

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

const { updateProfileField } = await import('@/actions/updateProfileField');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

describe('updateProfileField', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a profile row for the signed-in user when none exists', async () => {
    const result = await updateProfileField({ field: 'pronouns', value: 'she/her' });

    expect(result).toEqual({ data: { field: 'pronouns', value: 'she/her' } });
    expect(db.userProfile.rows).toHaveLength(1);
    expect(db.userProfile.rows[0]).toEqual(
      expect.objectContaining({
        userId: sessionUser.id,
        pronouns: 'she/her',
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/account');
  });

  it('updates a field on an existing profile row', async () => {
    await db.userProfile.create({
      data: { userId: sessionUser.id, pronouns: 'they/them' },
    });

    const result = await updateProfileField({ field: 'pronouns', value: 'she/her' });

    expect(result).toEqual({ data: { field: 'pronouns', value: 'she/her' } });
    expect(db.userProfile.rows).toHaveLength(1);
    expect(db.userProfile.rows[0]?.pronouns).toBe('she/her');
  });

  it('writes the public name to User.name', async () => {
    await db.user.create({
      data: { id: sessionUser.id, email: sessionUser.email, name: 'Ada', username: 'ada' },
    });

    const result = await updateProfileField({ field: 'publicName', value: 'Ada Lovelace' });

    expect(result).toEqual({ data: { field: 'publicName', value: 'Ada Lovelace' } });
    expect(db.user.rows[0]?.name).toBe('Ada Lovelace');
    expect(db.userProfile.rows).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith('/account');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('returns and stores the trimmed public name', async () => {
    await db.user.create({
      data: { id: sessionUser.id, email: sessionUser.email, name: 'Ada', username: 'ada' },
    });

    const result = await updateProfileField({
      field: 'publicName',
      value: '  Ada Lovelace  ',
    });

    expect(result).toEqual({ data: { field: 'publicName', value: 'Ada Lovelace' } });
    expect(db.user.rows[0]?.name).toBe('Ada Lovelace');
  });

  it('ignores a forged userId and always uses the session user', async () => {
    const result = await updateProfileField({
      field: 'location',
      value: 'London',
      userId: otherUserId,
    } as { field: string; value: string });

    expect(result).toEqual({ data: { field: 'location', value: 'London' } });
    expect(db.userProfile.rows[0]?.userId).toBe(sessionUser.id);
    expect(db.userProfile.rows[0]?.userId).not.toBe(otherUserId);
  });

  it('rejects an empty public name', async () => {
    const result = await updateProfileField({ field: 'publicName', value: '   ' });

    expect(result).toEqual({ fieldErrors: { value: expect.any(String) } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an unknown field such as email', async () => {
    const result = await updateProfileField({ field: 'email', value: 'new@example.com' });

    expect(result).toEqual({ fieldErrors: { field: expect.any(String) } });
    expect(db.userProfile.rows).toHaveLength(0);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await updateProfileField({ field: 'pronouns', value: 'she/her' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.userProfile.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.userProfile.upsert.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await updateProfileField({ field: 'pronouns', value: 'she/her' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.userProfile.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
