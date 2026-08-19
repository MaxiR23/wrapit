// tests/actions/setProjectStarred.test.ts
//
// Tests for the setProjectStarred server action.
//
// Tested:
// - Writes the given starred value without inverting
// - Setting true when already true stays true
// - Does not create a membership for a non-member
// - Rejects starring when the user has no membership, even as creator
// - Rejects the call when there is no session
// - Returns a generic error when getSession rejects
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Idempotent write, missing membership, unauthorized, session lookup
//   failure, unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/setProjectStarred.test.ts
//
// SEE: src/actions/setProjectStarred.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

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

const { setProjectStarred } = await import('@/actions/setProjectStarred');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

describe('setProjectStarred', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('writes starred true without inverting an unstarred membership', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      starred: false,
    });

    const result = await setProjectStarred(project.id, true);

    expect(result).toEqual({ data: { starred: true } });
    expect(db.membership.rows[0]?.starred).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('writes starred false without inverting a starred membership', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      starred: true,
    });

    const result = await setProjectStarred(project.id, false);

    expect(result).toEqual({ data: { starred: false } });
    expect(db.membership.rows[0]?.starred).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('is idempotent: setting true when already true stays true', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      starred: true,
    });

    const first = await setProjectStarred(project.id, true);
    const second = await setProjectStarred(project.id, true);

    expect(first).toEqual({ data: { starred: true } });
    expect(second).toEqual({ data: { starred: true } });
    expect(db.membership.rows).toHaveLength(1);
    expect(db.membership.rows[0]?.starred).toBe(true);
  });

  it('rejects starring when the creator has no membership row', async () => {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });

    const result = await setProjectStarred(project.id, true);

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('does not create a membership for a user who is not a member', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    const result = await setProjectStarred(project.id, true);

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });

    const result = await setProjectStarred(project.id, true);

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when getSession rejects', async () => {
    getSession.mockRejectedValueOnce(new Error('auth unavailable'));
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });

    const result = await setProjectStarred(project.id, true);

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.membership.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.membership.update.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await setProjectStarred(project.id, true);

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
