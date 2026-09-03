// tests/actions/updateMembershipRole.test.ts
//
// Tests for the updateMembershipRole server action.
//
// Tested:
// - An OWNER or ADMIN can promote a MEMBER to ADMIN
// - An ADMIN can demote another ADMIN, and can demote themselves
// - Promote stores the current access and sets EDIT; demote restores it
// - Demotion with nothing stored lands on EDIT
// - A leftover accessBeforeAdmin on a MEMBER is overwritten on promote
// - Same-role is a no-op with no write and no activity
// - A MEMBER and a non-member are rejected
// - An OWNER target is rejected from every caller
// - Occupancy miss returns the elsewhere message plus the committed snapshot
// - After every path, OWNER and ADMIN remain at EDIT
// - A demoted member keeps restored board access and can no longer administer
// - Both promotion and demotion appear in the project log
//
// What is covered:
// - Happy path, restore, leftover overwrite, no-op, authz, occupancy, activity,
//   check constraint, lost administration
//
// Run with: pnpm test:run tests/actions/updateMembershipRole.test.ts
//
// SEE: src/actions/updateMembershipRole.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE } from '@/lib/messages';
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

const { updateMembershipRole } = await import('@/actions/updateMembershipRole');
const { createInvitation } = await import('@/actions/createInvitation');
const { removeMember } = await import('@/actions/removeMember');
const { updateMembershipAccess } = await import('@/actions/updateMembershipAccess');
const { updatePublicLink } = await import('@/actions/updatePublicLink');
const { createCard } = await import('@/actions/createCard');
const { createComment } = await import('@/actions/createComment');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

function expectPrivilegedEdit(rows: Array<Record<string, unknown>>) {
  for (const row of rows) {
    if (row.role === 'OWNER' || row.role === 'ADMIN') {
      expect(row.access).toBe('EDIT');
    }
  }
}

async function seedOwnerAndMember(access: 'EDIT' | 'COMMENT' | 'VIEW' = 'VIEW') {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
  });
  await db.user.create({
    data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
  });
  const member = await db.membership.create({
    data: {
      userId: 'user-max',
      projectId: project.id,
      role: 'MEMBER',
      access,
    },
  });
  return { project, member };
}

describe('updateMembershipRole', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('lets the OWNER promote a MEMBER to ADMIN and stores the prior access', async () => {
    const { project, member } = await seedOwnerAndMember('VIEW');

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'ADMIN',
    });

    expect(result).toEqual({ data: { role: 'ADMIN', access: 'EDIT' } });
    expect(db.membership.rows.find((row) => row.id === member.id)).toEqual(
      expect.objectContaining({
        role: 'ADMIN',
        access: 'EDIT',
        accessBeforeAdmin: 'VIEW',
      }),
    );
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'MEMBER_PROMOTED',
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
    expectPrivilegedEdit(db.membership.rows);
  });

  it('lets an ADMIN promote a MEMBER', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'ADMIN',
    });
    await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER', access: 'EDIT' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const member = await db.membership.create({
      data: {
        userId: 'user-max',
        projectId: project.id,
        role: 'MEMBER',
        access: 'COMMENT',
      },
    });

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'ADMIN',
    });

    expect(result).toEqual({ data: { role: 'ADMIN', access: 'EDIT' } });
    expect(db.membership.rows.find((row) => row.id === member.id)?.role).toBe('ADMIN');
    expectPrivilegedEdit(db.membership.rows);
  });

  it('lets an ADMIN demote another ADMIN and restores the stored access', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'ADMIN',
    });
    await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER', access: 'EDIT' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const admin = await db.membership.create({
      data: {
        userId: 'user-max',
        projectId: project.id,
        role: 'ADMIN',
        access: 'EDIT',
        accessBeforeAdmin: 'COMMENT',
      },
    });

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: admin.id,
      role: 'MEMBER',
    });

    expect(result).toEqual({ data: { role: 'MEMBER', access: 'COMMENT' } });
    expect(db.membership.rows.find((row) => row.id === admin.id)).toEqual(
      expect.objectContaining({
        role: 'MEMBER',
        access: 'COMMENT',
        accessBeforeAdmin: null,
      }),
    );
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({ type: 'MEMBER_DEMOTED', actorId: sessionUser.id }),
    ]);
    expectPrivilegedEdit(db.membership.rows);
  });

  it('lets an admin demote themselves', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'ADMIN',
    });
    await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER', access: 'EDIT' },
    });
    await db.user.create({
      data: { id: sessionUser.id, name: 'Ada', username: 'ada' },
    });
    const self = db.membership.rows.find((row) => row.userId === sessionUser.id);

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: String(self?.id),
      role: 'MEMBER',
    });

    expect(result).toEqual({ data: { role: 'MEMBER', access: 'EDIT' } });
    expect(db.membership.rows.find((row) => row.userId === sessionUser.id)?.role).toBe('MEMBER');
    expectPrivilegedEdit(db.membership.rows);
  });

  it('returns the exact prior access after promote then demote', async () => {
    const { project, member } = await seedOwnerAndMember('COMMENT');

    expect(
      await updateMembershipRole({
        projectId: project.id,
        membershipId: member.id,
        role: 'ADMIN',
      }),
    ).toEqual({ data: { role: 'ADMIN', access: 'EDIT' } });
    expect(
      await updateMembershipRole({
        projectId: project.id,
        membershipId: member.id,
        role: 'MEMBER',
      }),
    ).toEqual({ data: { role: 'MEMBER', access: 'COMMENT' } });
    expect(db.membership.rows.find((row) => row.id === member.id)).toEqual(
      expect.objectContaining({
        role: 'MEMBER',
        access: 'COMMENT',
        accessBeforeAdmin: null,
      }),
    );
    expect(db.activityEvent.rows.map((row) => row.type)).toEqual([
      'MEMBER_PROMOTED',
      'MEMBER_DEMOTED',
    ]);
    expectPrivilegedEdit(db.membership.rows);
  });

  it('lands on EDIT when demoting with nothing stored', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const admin = await db.membership.create({
      data: {
        userId: 'user-max',
        projectId: project.id,
        role: 'ADMIN',
        access: 'EDIT',
      },
    });

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: admin.id,
      role: 'MEMBER',
    });

    expect(result).toEqual({ data: { role: 'MEMBER', access: 'EDIT' } });
    expect(db.membership.rows.find((row) => row.id === admin.id)?.accessBeforeAdmin ?? null).toBe(
      null,
    );
    expectPrivilegedEdit(db.membership.rows);
  });

  it('overwrites a leftover accessBeforeAdmin when promoting a MEMBER', async () => {
    const { project, member } = await seedOwnerAndMember('COMMENT');
    const row = db.membership.rows.find((item) => item.id === member.id);
    if (row) row.accessBeforeAdmin = 'VIEW';

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'ADMIN',
    });

    expect(result).toEqual({ data: { role: 'ADMIN', access: 'EDIT' } });
    expect(db.membership.rows.find((item) => item.id === member.id)?.accessBeforeAdmin).toBe(
      'COMMENT',
    );
    expectPrivilegedEdit(db.membership.rows);
  });

  it('no-ops a same-role request without writing or logging', async () => {
    const { project, member } = await seedOwnerAndMember('VIEW');

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'MEMBER',
    });

    expect(result).toEqual({ data: { role: 'MEMBER', access: 'VIEW' } });
    expect(db.membership.rows.find((row) => row.id === member.id)).toEqual(
      expect.objectContaining({ role: 'MEMBER', access: 'VIEW' }),
    );
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
    expectPrivilegedEdit(db.membership.rows);
  });

  it('rejects when the actor is a MEMBER', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'MEMBER',
    });
    await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER', access: 'EDIT' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const other = await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER', access: 'EDIT' },
    });

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: other.id,
      role: 'ADMIN',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.find((row) => row.id === other.id)?.role).toBe('MEMBER');
    expect(db.activityEvent.rows).toHaveLength(0);
    expectPrivilegedEdit(db.membership.rows);
  });

  it('rejects a non-member', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-owner',
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const member = await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER', access: 'EDIT' },
    });

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'ADMIN',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.find((row) => row.id === member.id)?.role).toBe('MEMBER');
    expectPrivilegedEdit(db.membership.rows);
  });

  it('rejects an OWNER target from every caller', async () => {
    const { project } = await seedOwnerAndMember();
    const owner = db.membership.rows.find((row) => row.userId === sessionUser.id);

    expect(
      await updateMembershipRole({
        projectId: project.id,
        membershipId: String(owner?.id),
        role: 'ADMIN',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.find((row) => row.id === owner?.id)?.role).toBe('OWNER');

    getSession.mockResolvedValue({
      user: { id: 'user-max', email: 'max@example.com', name: 'Maxi', username: 'maxi' },
    });
    const member = db.membership.rows.find((row) => row.userId === 'user-max');
    expect(
      await updateMembershipRole({
        projectId: project.id,
        membershipId: String(owner?.id),
        role: 'MEMBER',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(member?.role).toBe('MEMBER');
    expectPrivilegedEdit(db.membership.rows);
  });

  it('returns the elsewhere message and the committed snapshot when occupancy misses', async () => {
    const { project, member } = await seedOwnerAndMember('VIEW');
    db.membership.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'ADMIN',
    });

    expect(result).toEqual({
      error: MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE,
      current: { role: 'MEMBER', access: 'VIEW' },
    });
    expect(result).not.toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.find((row) => row.id === member.id)).toEqual(
      expect.objectContaining({ role: 'MEMBER', access: 'VIEW' }),
    );
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
    expectPrivilegedEdit(db.membership.rows);
  });

  it('re-reads the row when occupancy misses after a concurrent promote', async () => {
    const { project, member } = await seedOwnerAndMember('VIEW');
    db.membership.updateMany.mockImplementationOnce(async () => {
      const row = db.membership.rows.find((item) => item.id === member.id);
      if (row) {
        row.role = 'ADMIN';
        row.access = 'EDIT';
        row.accessBeforeAdmin = 'VIEW';
      }
      return { count: 0 };
    });

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'ADMIN',
    });

    expect(result).toEqual({
      error: MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE,
      current: { role: 'ADMIN', access: 'EDIT' },
    });
    expect(db.activityEvent.rows).toHaveLength(0);
    expectPrivilegedEdit(db.membership.rows);
  });

  it('rolls back the role write when activity logging fails', async () => {
    const { project, member } = await seedOwnerAndMember('VIEW');
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'ADMIN',
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.membership.rows.find((row) => row.id === member.id)?.role).toBe('MEMBER');
    expect(db.activityEvent.rows).toHaveLength(0);
    expectPrivilegedEdit(db.membership.rows);
  });

  it('rejects an empty, oversized, or OWNER role without a lookup', async () => {
    expect(
      await updateMembershipRole({ projectId: '', membershipId: 'mem-1', role: 'ADMIN' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await updateMembershipRole({
        projectId: 'p'.repeat(MAX_ID_LENGTH + 1),
        membershipId: 'mem-1',
        role: 'ADMIN',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await updateMembershipRole({
        projectId: 'project-1',
        membershipId: 'mem-1',
        role: 'OWNER',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.membership.updateMany).not.toHaveBeenCalled();
  });

  it('lets a demoted member keep restored access and refuse team administration', async () => {
    const { project, member } = await seedOwnerAndMember('COMMENT');
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Write tests', order: 1, columnId: todo.id, code: 'SB-1' },
    });

    await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'ADMIN',
    });
    await updateMembershipRole({
      projectId: project.id,
      membershipId: member.id,
      role: 'MEMBER',
    });

    getSession.mockResolvedValue({
      user: { id: 'user-max', email: 'max@example.com', name: 'Maxi', username: 'maxi' },
    });

    expect(await createComment({ cardId: card.id, body: 'Looks good' })).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ body: 'Looks good' }) }),
    );
    expect(await createCard({ columnId: todo.id, title: 'Nope' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await createInvitation({ projectId: project.id, username: 'grace' })).toEqual({
      error: 'Unauthorized',
    });
    const owner = db.membership.rows.find((row) => row.userId === sessionUser.id);
    expect(await removeMember({ projectId: project.id, membershipId: String(owner?.id) })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await updateMembershipAccess({
        projectId: project.id,
        membershipId: String(owner?.id),
        access: 'VIEW',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await updateMembershipRole({
        projectId: project.id,
        membershipId: String(owner?.id),
        role: 'ADMIN',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await updatePublicLink({ projectId: project.id, enabled: true })).toEqual({
      error: 'Unauthorized',
    });
    expectPrivilegedEdit(db.membership.rows);
  });
});
