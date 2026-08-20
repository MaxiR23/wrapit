// tests/actions/deleteUserStatus.test.ts
//
// Tests for the deleteUserStatus server action.
//
// Tested:
// - Deletes an owned status and leaves a non-active selection in place
// - Moves activeStatusId backwards when the active row is deleted
// - Moves activeStatusId to the new first row when the first (active) row is deleted
// - Rejects deleting the last remaining status and rolls the delete back
// - Serializes overlapping deletes of the last two statuses so one remains
// - Rejects a status that belongs to another user
// - Rejects an invalid id before touching Prisma
// - Ignores a forged userId
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, active-moves-backwards, last-status rollback, concurrent last-two
//   deletes, ownership, validation-before-lookup, unauthorized, unexpected failure
//
// Run with: pnpm test:run tests/actions/deleteUserStatus.test.ts
//
// SEE: src/actions/deleteUserStatus.ts

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

const { deleteUserStatus } = await import('@/actions/deleteUserStatus');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

async function seedThree() {
  await db.user.create({ data: { ...sessionUser, activeStatusId: 's1' } });
  await db.userStatus.create({
    data: { id: 's0', userId: sessionUser.id, name: 'Active', color: 'green', order: 0 },
  });
  await db.userStatus.create({
    data: { id: 's1', userId: sessionUser.id, name: 'Inactive', color: 'gray', order: 1 },
  });
  await db.userStatus.create({
    data: { id: 's2', userId: sessionUser.id, name: 'Away', color: 'red', order: 2 },
  });
}

describe('deleteUserStatus', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('deletes a non-active status and leaves activeStatusId unchanged', async () => {
    await seedThree();

    const result = await deleteUserStatus({ statusId: 's0' });

    expect(result).toEqual({ data: { id: 's0', activeStatusId: 's1' } });
    expect(db.userStatus.rows.map((row) => row.id)).toEqual(['s1', 's2']);
    expect(db.user.rows[0]?.activeStatusId).toBe('s1');
  });

  it('moves activeStatusId to the previous row when the active status is deleted', async () => {
    await seedThree();

    const result = await deleteUserStatus({ statusId: 's1' });

    expect(result).toEqual({ data: { id: 's1', activeStatusId: 's0' } });
    expect(db.userStatus.rows.map((row) => row.id)).toEqual(['s0', 's2']);
    expect(db.user.rows[0]?.activeStatusId).toBe('s0');
  });

  it('moves activeStatusId to the new first row when the first active status is deleted', async () => {
    await db.user.create({ data: { ...sessionUser, activeStatusId: 's0' } });
    await db.userStatus.create({
      data: { id: 's0', userId: sessionUser.id, name: 'Active', color: 'green', order: 0 },
    });
    await db.userStatus.create({
      data: { id: 's1', userId: sessionUser.id, name: 'Inactive', color: 'gray', order: 1 },
    });

    const result = await deleteUserStatus({ statusId: 's0' });

    expect(result).toEqual({ data: { id: 's0', activeStatusId: 's1' } });
    expect(db.user.rows[0]?.activeStatusId).toBe('s1');
  });

  it('rejects deleting the last remaining status and rolls the delete back', async () => {
    await db.user.create({ data: { ...sessionUser, activeStatusId: 's0' } });
    await db.userStatus.create({
      data: { id: 's0', userId: sessionUser.id, name: 'Active', color: 'green', order: 0 },
    });

    const result = await deleteUserStatus({ statusId: 's0' });

    expect(result).toEqual({ error: 'Cannot delete the last status' });
    expect(db.userStatus.rows).toHaveLength(1);
    expect(db.userStatus.rows[0]?.id).toBe('s0');
    expect(db.user.rows[0]?.activeStatusId).toBe('s0');
  });

  it('serializes overlapping deletes of the last two statuses so one remains', async () => {
    await db.user.create({ data: { ...sessionUser, activeStatusId: 's0' } });
    await db.userStatus.create({
      data: { id: 's0', userId: sessionUser.id, name: 'Active', color: 'green', order: 0 },
    });
    await db.userStatus.create({
      data: { id: 's1', userId: sessionUser.id, name: 'Inactive', color: 'gray', order: 1 },
    });

    const results = await Promise.all([
      deleteUserStatus({ statusId: 's0' }),
      deleteUserStatus({ statusId: 's1' }),
    ]);

    const succeeded = results.filter((result) => 'data' in result);
    const failed = results.filter((result) => 'error' in result);
    expect(succeeded).toHaveLength(1);
    expect(failed).toEqual([{ error: 'Cannot delete the last status' }]);
    expect(db.userStatus.rows).toHaveLength(1);
    expect(db.user.rows[0]?.activeStatusId).toBe(db.userStatus.rows[0]?.id);
  });

  it('rejects a status that belongs to another user', async () => {
    await db.user.create({ data: { ...sessionUser, activeStatusId: 's0' } });
    await db.userStatus.create({
      data: { id: 's0', userId: sessionUser.id, name: 'Active', color: 'green', order: 0 },
    });
    await db.userStatus.create({
      data: { id: 'other', userId: otherUserId, name: 'Active', color: 'green', order: 0 },
    });

    const result = await deleteUserStatus({ statusId: 'other' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.userStatus.rows).toHaveLength(2);
  });

  it('rejects an invalid id before touching Prisma', async () => {
    const result = await deleteUserStatus({ statusId: 'a'.repeat(MAX_ID_LENGTH + 1) });

    expect(result).toEqual({ fieldErrors: { statusId: expect.any(String) } });
    expect(db.userStatus.deleteMany).not.toHaveBeenCalled();
  });

  it('ignores a forged userId and always uses the session user', async () => {
    await seedThree();
    await db.userStatus.create({
      data: { id: 'other', userId: otherUserId, name: 'Active', color: 'green', order: 0 },
    });

    const result = await deleteUserStatus({ statusId: 's2', userId: otherUserId } as {
      statusId: string;
    });

    expect(result).toEqual({ data: { id: 's2', activeStatusId: 's1' } });
    expect(db.userStatus.rows.map((row) => row.id)).toEqual(['s0', 's1', 'other']);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await deleteUserStatus({ statusId: 's0' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.userStatus.deleteMany).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    await db.user.create({ data: { ...sessionUser, activeStatusId: 's0' } });
    db.userStatus.findFirst.mockRejectedValueOnce(new Error('connection refused'));

    const result = await deleteUserStatus({ statusId: 's0' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});
