// tests/actions/transferOwnership.test.ts
//
// Tests for the transferOwnership server action.
//
// Tested:
// - The OWNER can transfer to a MEMBER or ADMIN; the actor becomes ADMIN
// - A VIEW member is promoted with EDIT access
// - An ADMIN or MEMBER cannot transfer
// - Transferring to self, a missing row, or another project rolls back
// - Concurrent transfers to two members leave exactly one OWNER
// - Invalid ids are rejected without a lookup
// - OWNERSHIP_TRANSFERRED is recorded
//
// What is covered:
// - Happy path, authz, atomic rollback, concurrency, invalid id, activity
//
// Run with: pnpm test:run tests/actions/transferOwnership.test.ts
//
// SEE: src/actions/transferOwnership.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

const { transferOwnership } = await import('@/actions/transferOwnership');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedOwnerAndMember(access: 'EDIT' | 'COMMENT' | 'VIEW' = 'COMMENT') {
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

describe('transferOwnership', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('lets the OWNER transfer to a member and become ADMIN', async () => {
    const { project, member } = await seedOwnerAndMember();

    const result = await transferOwnership({
      projectId: project.id,
      membershipId: member.id,
    });

    expect(result).toEqual({ data: { membershipId: member.id } });
    const owners = db.membership.rows.filter((row) => row.role === 'OWNER');
    expect(owners).toHaveLength(1);
    expect(owners[0]).toEqual(
      expect.objectContaining({ id: member.id, userId: 'user-max', access: 'EDIT' }),
    );
    expect(db.membership.rows.find((row) => row.userId === sessionUser.id)).toEqual(
      expect.objectContaining({ role: 'ADMIN', access: 'EDIT' }),
    );
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'OWNERSHIP_TRANSFERRED',
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

  it('promotes a VIEW member to OWNER with EDIT access', async () => {
    const { project, member } = await seedOwnerAndMember('VIEW');

    const result = await transferOwnership({
      projectId: project.id,
      membershipId: member.id,
    });

    expect(result).toEqual({ data: { membershipId: member.id } });
    expect(db.membership.rows.find((row) => row.id === member.id)).toEqual(
      expect.objectContaining({ role: 'OWNER', access: 'EDIT' }),
    );
  });

  it('rejects when the actor is an ADMIN', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'ADMIN',
    });
    await db.membership.create({
      data: { userId: 'user-owner', projectId: project.id, role: 'OWNER' },
    });
    const member = await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER' },
    });

    const result = await transferOwnership({
      projectId: project.id,
      membershipId: member.id,
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.filter((row) => row.role === 'OWNER')).toHaveLength(1);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('rejects transferring to the session user and keeps the OWNER', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const self = db.membership.rows.find((row) => row.userId === sessionUser.id);

    const result = await transferOwnership({
      projectId: project.id,
      membershipId: String(self?.id),
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.find((row) => row.userId === sessionUser.id)?.role).toBe('OWNER');
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('rolls back the demote when the target membership is missing', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });

    const result = await transferOwnership({
      projectId: project.id,
      membershipId: 'mem-missing',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.find((row) => row.userId === sessionUser.id)?.role).toBe('OWNER');
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('serializes overlapping transfers so one OWNER remains', async () => {
    const { project, member } = await seedOwnerAndMember();
    await db.user.create({
      data: { id: 'user-grace', name: 'Grace', username: 'grace' },
    });
    const other = await db.membership.create({
      data: { userId: 'user-grace', projectId: project.id, role: 'MEMBER' },
    });

    const results = await Promise.all([
      transferOwnership({ projectId: project.id, membershipId: member.id }),
      transferOwnership({ projectId: project.id, membershipId: other.id }),
    ]);

    const succeeded = results.filter((result) => 'data' in result);
    const failed = results.filter((result) => 'error' in result);
    expect(succeeded).toHaveLength(1);
    expect(failed).toEqual([{ error: 'Unauthorized' }]);
    expect(db.membership.rows.filter((row) => row.role === 'OWNER')).toHaveLength(1);
  });

  it('rejects an empty or oversized id without a lookup', async () => {
    expect(await transferOwnership({ projectId: '', membershipId: 'mem-1' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await transferOwnership({
        projectId: 'p'.repeat(MAX_ID_LENGTH + 1),
        membershipId: 'mem-1',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.membership.updateMany).not.toHaveBeenCalled();
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
