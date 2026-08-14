// tests/actions/updateViewMode.test.ts
//
// Tests for the updateViewMode server action.
//
// Tested:
// - Creates a preferences row for the session user when none exists
// - Updates viewMode on an existing row
// - Ignores a forged userId and always uses the session user
// - Rejects an invalid viewMode
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path create and update, ownership, invalid input, unauthorized,
//   unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/updateViewMode.test.ts
//
// SEE: src/actions/updateViewMode.ts

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

const { updateViewMode } = await import('@/actions/updateViewMode');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

describe('updateViewMode', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a preferences row for the signed-in user when none exists', async () => {
    const result = await updateViewMode({ viewMode: 'list' });

    expect(result).toEqual({ data: { viewMode: 'list' } });
    expect(db.userPreferences.rows).toHaveLength(1);
    expect(db.userPreferences.rows[0]).toEqual(
      expect.objectContaining({
        userId: sessionUser.id,
        viewMode: 'LIST',
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('updates viewMode on an existing preferences row', async () => {
    await db.userPreferences.create({
      data: { userId: sessionUser.id, viewMode: 'GRID' },
    });

    const result = await updateViewMode({ viewMode: 'list' });

    expect(result).toEqual({ data: { viewMode: 'list' } });
    expect(db.userPreferences.rows).toHaveLength(1);
    expect(db.userPreferences.rows[0]?.viewMode).toBe('LIST');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('ignores a forged userId and always uses the session user', async () => {
    const result = await updateViewMode({
      viewMode: 'list',
      userId: otherUserId,
    } as { viewMode: 'grid' | 'list' });

    expect(result).toEqual({ data: { viewMode: 'list' } });
    expect(db.userPreferences.rows[0]?.userId).toBe(sessionUser.id);
    expect(db.userPreferences.rows[0]?.userId).not.toBe(otherUserId);
  });

  it('rejects an invalid viewMode', async () => {
    const result = await updateViewMode({ viewMode: 'kanban' } as unknown as {
      viewMode: 'grid' | 'list';
    });

    expect(result).toEqual({
      fieldErrors: { viewMode: expect.any(String) },
    });
    expect(db.userPreferences.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await updateViewMode({ viewMode: 'list' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.userPreferences.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.userPreferences.upsert.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await updateViewMode({ viewMode: 'list' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.userPreferences.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
