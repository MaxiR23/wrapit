// tests/actions/updateBoardVisibility.test.ts
//
// Tests for the updateBoardVisibility server action.
//
// Tested:
// - Creates a preferences row for the session user when none exists
// - Updates visibility flags on an existing row
// - Ignores a forged userId and always uses the session user
// - Rejects a non-boolean flag
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path create and update, ownership, invalid input, unauthorized,
//   unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/updateBoardVisibility.test.ts
//
// SEE: src/actions/updateBoardVisibility.ts

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

const { updateBoardVisibility } = await import('@/actions/updateBoardVisibility');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

const allOn = {
  label: true,
  code: true,
  comments: true,
  subtasks: true,
  dueDate: true,
  assignees: true,
};

describe('updateBoardVisibility', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a preferences row for the signed-in user when none exists', async () => {
    const result = await updateBoardVisibility({ ...allOn, label: false });

    expect(result).toEqual({ data: { ...allOn, label: false } });
    expect(db.userPreferences.rows).toHaveLength(1);
    expect(db.userPreferences.rows[0]).toEqual(
      expect.objectContaining({
        userId: sessionUser.id,
        showCardLabel: false,
        showCardCode: true,
        showCardComments: true,
        showCardSubtasks: true,
        showCardDueDate: true,
        showCardAssignees: true,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/projects', 'layout');
  });

  it('updates visibility flags on an existing preferences row', async () => {
    await db.userPreferences.create({
      data: { userId: sessionUser.id, viewMode: 'GRID' },
    });

    const result = await updateBoardVisibility({ ...allOn, code: false, dueDate: false });

    expect(result).toEqual({ data: { ...allOn, code: false, dueDate: false } });
    expect(db.userPreferences.rows).toHaveLength(1);
    expect(db.userPreferences.rows[0]).toEqual(
      expect.objectContaining({
        showCardCode: false,
        showCardDueDate: false,
        showCardLabel: true,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/projects', 'layout');
  });

  it('ignores a forged userId and always uses the session user', async () => {
    const result = await updateBoardVisibility({
      ...allOn,
      userId: otherUserId,
    } as typeof allOn);

    expect(result).toEqual({ data: allOn });
    expect(db.userPreferences.rows[0]?.userId).toBe(sessionUser.id);
    expect(db.userPreferences.rows[0]?.userId).not.toBe(otherUserId);
  });

  it('rejects a non-boolean flag', async () => {
    const result = await updateBoardVisibility({
      ...allOn,
      label: 'off',
    } as unknown as typeof allOn);

    expect(result).toEqual({
      fieldErrors: { label: expect.any(String) },
    });
    expect(db.userPreferences.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await updateBoardVisibility({ ...allOn, label: false });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.userPreferences.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.userPreferences.upsert.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await updateBoardVisibility({ ...allOn, label: false });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.userPreferences.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
