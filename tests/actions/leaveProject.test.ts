// tests/actions/leaveProject.test.ts
//
// Tests for the leaveProject server action.
//
// Tested:
// - An ADMIN or MEMBER can leave; membership, assignees, and recents go
// - The OWNER is refused with the transfer message and nothing is written
// - A non-member is Unauthorized
// - Invalid ids are rejected without a lookup
// - MEMBER_LEFT is recorded
//
// What is covered:
// - Happy path, owner refusal, unauthorized, invalid id, activity, cleanup
//
// Run with: pnpm test:run tests/actions/leaveProject.test.ts
//
// SEE: src/actions/leaveProject.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { accessibleByUser } from '@/lib/membership';
import { OWNER_MUST_TRANSFER_MESSAGE } from '@/lib/messages';
import { MAX_ID_LENGTH } from '@/lib/validation/id';

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

const { leaveProject } = await import('@/actions/leaveProject');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedMemberOnBoard(role: 'ADMIN' | 'MEMBER') {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
    ownerId: 'user-owner',
    role,
  });
  await db.membership.create({
    data: { userId: 'user-owner', projectId: project.id, role: 'OWNER' },
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 0, projectId: project.id },
  });
  const card = await db.card.create({
    data: { title: 'Write tests', order: 0, columnId: column.id },
  });
  await db.cardAssignee.create({
    data: { cardId: card.id, userId: sessionUser.id },
  });
  await db.recentProject.create({
    data: { userId: sessionUser.id, projectId: project.id, openedAt: new Date() },
  });
  return { project, card };
}

describe('leaveProject', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('lets an ADMIN leave, unassigns their cards, and drops recents', async () => {
    const { project, card } = await seedMemberOnBoard('ADMIN');

    const result = await leaveProject({ projectId: project.id });

    expect(result).toEqual({ data: { projectId: project.id } });
    expect(db.membership.rows.some((row) => row.userId === sessionUser.id)).toBe(false);
    expect(db.card.rows.some((row) => row.id === card.id)).toBe(true);
    expect(
      db.cardAssignee.rows.some((row) => row.cardId === card.id && row.userId === sessionUser.id),
    ).toBe(false);
    expect(
      db.recentProject.rows.some(
        (row) => row.userId === sessionUser.id && row.projectId === project.id,
      ),
    ).toBe(false);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'MEMBER_LEFT',
        projectId: project.id,
        actorId: sessionUser.id,
        payload: expect.objectContaining({ actorName: 'Ada' }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('lets a MEMBER leave', async () => {
    const { project } = await seedMemberOnBoard('MEMBER');

    const result = await leaveProject({ projectId: project.id });

    expect(result).toEqual({ data: { projectId: project.id } });
    expect(db.membership.rows.some((row) => row.userId === sessionUser.id)).toBe(false);
  });

  it('refuses the OWNER with the transfer message and does not write', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });

    const result = await leaveProject({ projectId: project.id });

    expect(result).toEqual({ error: OWNER_MUST_TRANSFER_MESSAGE });
    expect(db.membership.rows.some((row) => row.userId === sessionUser.id)).toBe(true);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('returns Unauthorized when the actor is not a member', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Secret board',
      userId: 'user-owner',
      ownerId: 'user-owner',
    });

    const result = await leaveProject({ projectId: project.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(result).not.toEqual({ error: OWNER_MUST_TRANSFER_MESSAGE });
    expect(db.membership.rows.some((row) => row.userId === 'user-owner')).toBe(true);
  });

  it('drops the project from membership-based access after leaving', async () => {
    const { project } = await seedMemberOnBoard('MEMBER');

    await leaveProject({ projectId: project.id });

    const accessible = await db.project.findFirst({
      where: { id: project.id, ...accessibleByUser(sessionUser.id) },
    });
    expect(accessible).toBeNull();
  });

  it('rejects an empty or oversized id without a lookup', async () => {
    expect(await leaveProject({ projectId: '' })).toEqual({ error: 'Unauthorized' });
    expect(await leaveProject({ projectId: 'p'.repeat(MAX_ID_LENGTH + 1) })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.membership.deleteMany).not.toHaveBeenCalled();
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
