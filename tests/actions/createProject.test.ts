// tests/actions/createProject.test.ts
//
// Tests for the createProject server action.
//
// Tested:
// - Creates a project owned by the signed-in user on valid input
// - Rejects an empty title with a clear field error
// - Ignores a forged ownerId and always uses the session user
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, invalid input, ownership, unauthorized, unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/createProject.test.ts
//
// SEE: src/actions/createProject.ts

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

const { createProject } = await import('@/actions/createProject');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

describe('createProject', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a project owned by the signed-in user on valid input', async () => {
    const result = await createProject({ title: 'Sprint board' });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Sprint board',
        ownerId: sessionUser.id,
      }),
    });
    expect(db.project.rows).toHaveLength(1);
    expect(db.project.rows[0]?.ownerId).toBe(sessionUser.id);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('rejects an empty title with a clear field error', async () => {
    const result = await createProject({ title: '' });

    expect(result).toEqual({ fieldErrors: { title: 'Title is required' } });
    expect(db.project.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('ignores a forged ownerId and always uses the session user', async () => {
    const result = await createProject({
      title: 'Stolen board',
      ownerId: otherUserId,
    } as { title: string });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Stolen board',
        ownerId: sessionUser.id,
      }),
    });
    expect(db.project.rows[0]?.ownerId).toBe(sessionUser.id);
    expect(db.project.rows[0]?.ownerId).not.toBe(otherUserId);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await createProject({ title: 'Sprint board' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.project.create.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await createProject({ title: 'Sprint board' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.project.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
