// tests/actions/removeMember.test.ts
//
// Tests for the removeMember server action.
//
// Tested:
// - An OWNER or ADMIN can remove a MEMBER
// - An ADMIN can remove a non-last OWNER
// - Removing a member unassigns them from cards on the project
// - Removing the last OWNER returns the last-owner message and does not write
// - The actor cannot remove themselves
// - A MEMBER cannot remove anyone
// - A non-admin passing a last-owner membership gets Unauthorized, not the last-owner message
// - Rejects an empty or oversized id without a lookup
//
// What is covered:
// - Happy path, last-owner guard, self, admin-only, unauthorized last-owner probe, invalid id
//
// Run with: pnpm test:run tests/actions/removeMember.test.ts
//
// SEE: src/actions/removeMember.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { LAST_OWNER_MESSAGE } from '@/lib/messages';
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

const { removeMember } = await import('@/actions/removeMember');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

describe('removeMember', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('lets an ADMIN remove a MEMBER', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'ADMIN',
    });
    await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const member = await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 0, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Write tests', order: 0, columnId: column.id },
    });
    await db.cardAssignee.create({
      data: { cardId: card.id, userId: 'user-max' },
    });

    const result = await removeMember({ projectId: project.id, membershipId: member.id });

    expect(result).toEqual({ data: { id: member.id } });
    expect(db.membership.rows.some((row) => row.id === member.id)).toBe(false);
    expect(db.card.rows.some((row) => row.id === card.id)).toBe(true);
    expect(
      db.cardAssignee.rows.some((row) => row.cardId === card.id && row.userId === 'user-max'),
    ).toBe(false);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'MEMBER_REMOVED',
        projectId: project.id,
        actorId: sessionUser.id,
        payload: expect.objectContaining({
          actorName: 'Ada',
          memberId: 'user-max',
          memberName: 'Maxi',
        }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('lets an ADMIN remove a non-last OWNER', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'ADMIN',
    });
    await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const otherOwner = await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'OWNER' },
    });

    const result = await removeMember({ projectId: project.id, membershipId: otherOwner.id });

    expect(result).toEqual({ data: { id: otherOwner.id } });
    expect(db.membership.rows.filter((row) => row.role === 'OWNER')).toHaveLength(1);
  });

  it('refuses to remove the last OWNER and does not write', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'ADMIN',
    });
    const owner = await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER' },
    });
    await db.user.create({
      data: { id: 'user-owner', name: 'Owner', username: 'owner' },
    });

    const result = await removeMember({ projectId: project.id, membershipId: owner.id });

    expect(result).toEqual({ error: LAST_OWNER_MESSAGE });
    expect(db.membership.rows.some((row) => row.id === owner.id)).toBe(true);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('rejects removing the session user', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.user.create({
      data: { id: sessionUser.id, name: 'Ada', username: 'ada' },
    });
    await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'OWNER' },
    });
    const self = db.membership.rows.find((row) => row.userId === sessionUser.id);

    const result = await removeMember({
      projectId: project.id,
      membershipId: String(self?.id),
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.some((row) => row.userId === sessionUser.id)).toBe(true);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('rejects when the actor is a MEMBER', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'MEMBER',
    });
    await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER' },
    });
    const other = await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER' },
    });

    const result = await removeMember({ projectId: project.id, membershipId: other.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.some((row) => row.id === other.id)).toBe(true);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('returns Unauthorized when a non-admin probes a last-owner membership', async () => {
    await seedAccessibleProject(db, {
      title: 'Ada board',
      userId: sessionUser.id,
    });
    const target = await seedAccessibleProject(db, {
      title: 'Secret board',
      userId: 'user-owner',
      ownerId: 'user-owner',
    });
    const lastOwner = db.membership.rows.find(
      (row) => row.projectId === target.id && row.role === 'OWNER',
    );

    const result = await removeMember({
      projectId: target.id,
      membershipId: String(lastOwner?.id),
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(result).not.toEqual({ error: LAST_OWNER_MESSAGE });
    expect(db.membership.rows.some((row) => row.id === lastOwner?.id)).toBe(true);
  });

  it('rejects an empty or oversized id without a lookup', async () => {
    expect(await removeMember({ projectId: '', membershipId: 'mem-1' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await removeMember({ projectId: 'p'.repeat(MAX_ID_LENGTH + 1), membershipId: 'mem-1' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.membership.deleteMany).not.toHaveBeenCalled();
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('rolls back the removal when logging fails', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'ADMIN',
    });
    await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const member = await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER' },
    });
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await removeMember({ projectId: project.id, membershipId: member.id });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.membership.rows.some((row) => row.id === member.id)).toBe(true);
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
