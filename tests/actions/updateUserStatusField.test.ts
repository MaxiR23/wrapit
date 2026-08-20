// tests/actions/updateUserStatusField.test.ts
//
// Tests for the updateUserStatusField server action.
//
// Tested:
// - Updates name, description, and color on an owned row
// - Stores the trimmed value
// - Rejects an empty name and an unknown color
// - Rejects a status that belongs to another user
// - Rejects an invalid id before touching Prisma
// - Ignores a forged userId
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, ownership, validation-before-lookup, unauthorized, unexpected failure
//
// Run with: pnpm test:run tests/actions/updateUserStatusField.test.ts
//
// SEE: src/actions/updateUserStatusField.ts

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

const { updateUserStatusField } = await import('@/actions/updateUserStatusField');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

describe('updateUserStatusField', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('updates name, description, and color on an owned row', async () => {
    await db.userStatus.create({
      data: {
        id: 'status-a',
        userId: sessionUser.id,
        name: 'Active',
        description: 'Available for the team',
        color: 'green',
        order: 0,
      },
    });

    expect(
      await updateUserStatusField({ statusId: 'status-a', field: 'name', value: ' Focus ' }),
    ).toEqual({ data: { value: 'Focus' } });
    expect(db.userStatus.rows[0]?.name).toBe('Focus');

    expect(
      await updateUserStatusField({ statusId: 'status-a', field: 'description', value: '' }),
    ).toEqual({ data: { value: '' } });
    expect(db.userStatus.rows[0]?.description).toBe('');

    expect(
      await updateUserStatusField({ statusId: 'status-a', field: 'color', value: 'blue' }),
    ).toEqual({ data: { value: 'blue' } });
    expect(db.userStatus.rows[0]?.color).toBe('blue');
  });

  it('rejects an empty name and an unknown color without writing', async () => {
    await db.userStatus.create({
      data: { id: 'status-a', userId: sessionUser.id, name: 'Active', color: 'green', order: 0 },
    });

    expect(
      await updateUserStatusField({ statusId: 'status-a', field: 'name', value: '   ' }),
    ).toEqual({ fieldErrors: { value: expect.any(String) } });
    expect(db.userStatus.rows[0]?.name).toBe('Active');

    expect(
      await updateUserStatusField({ statusId: 'status-a', field: 'color', value: 'pink' }),
    ).toEqual({ fieldErrors: { value: expect.any(String) } });
    expect(db.userStatus.rows[0]?.color).toBe('green');
    expect(db.userStatus.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a status that belongs to another user', async () => {
    await db.userStatus.create({
      data: { id: 'status-other', userId: otherUserId, name: 'Active', color: 'green', order: 0 },
    });

    const result = await updateUserStatusField({
      statusId: 'status-other',
      field: 'name',
      value: 'Nope',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.userStatus.rows[0]?.name).toBe('Active');
  });

  it('rejects an invalid id before touching Prisma', async () => {
    const result = await updateUserStatusField({
      statusId: 'a'.repeat(MAX_ID_LENGTH + 1),
      field: 'name',
      value: 'Focus',
    });

    expect(result).toEqual({ fieldErrors: { statusId: expect.any(String) } });
    expect(db.userStatus.updateMany).not.toHaveBeenCalled();
  });

  it('ignores a forged userId and always uses the session user', async () => {
    await db.userStatus.create({
      data: { id: 'status-a', userId: sessionUser.id, name: 'Active', color: 'green', order: 0 },
    });
    await db.userStatus.create({
      data: { id: 'status-other', userId: otherUserId, name: 'Active', color: 'green', order: 0 },
    });

    const result = await updateUserStatusField({
      statusId: 'status-a',
      field: 'name',
      value: 'Focus',
      userId: otherUserId,
    } as { statusId: string; field: string; value: string });

    expect(result).toEqual({ data: { value: 'Focus' } });
    expect(db.userStatus.rows[0]?.name).toBe('Focus');
    expect(db.userStatus.rows[1]?.name).toBe('Active');
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await updateUserStatusField({
      statusId: 'status-a',
      field: 'name',
      value: 'Focus',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    db.userStatus.updateMany.mockRejectedValueOnce(new Error('connection refused'));

    const result = await updateUserStatusField({
      statusId: 'status-a',
      field: 'name',
      value: 'Focus',
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});
