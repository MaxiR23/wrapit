// tests/actions/updateMembershipAccess.test.ts
//
// Tests for the updateMembershipAccess server action.
//
// Tested:
// - An OWNER or ADMIN can change a MEMBER's board access
// - A MEMBER cannot change access
// - OWNER and ADMIN rows cannot have their access changed
// - Rejects when there is no session
// - Rejects an empty, oversized, or unknown access without a lookup
//
// What is covered:
// - Happy path, admin-only, privileged rows locked, unauthorized, invalid input
//
// Run with: pnpm test:run tests/actions/updateMembershipAccess.test.ts
//
// SEE: src/actions/updateMembershipAccess.ts

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

const { updateMembershipAccess } = await import('@/actions/updateMembershipAccess');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

describe('updateMembershipAccess', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('lets an ADMIN change a MEMBER to VIEW', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'ADMIN',
    });
    const member = await db.membership.create({
      data: {
        userId: 'user-max',
        projectId: project.id,
        role: 'MEMBER',
        access: 'COMMENT',
      },
    });

    const result = await updateMembershipAccess({
      projectId: project.id,
      membershipId: member.id,
      access: 'VIEW',
    });

    expect(result).toEqual({ data: { access: 'VIEW' } });
    expect(db.membership.rows.find((row) => row.id === member.id)?.access).toBe('VIEW');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects when the actor is a MEMBER', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'MEMBER',
    });
    const other = await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER', access: 'EDIT' },
    });

    const result = await updateMembershipAccess({
      projectId: project.id,
      membershipId: other.id,
      access: 'VIEW',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows.find((row) => row.id === other.id)?.access).toBe('EDIT');
  });

  it('does not change an OWNER or ADMIN row', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const admin = await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'ADMIN', access: 'EDIT' },
    });

    const owner = db.membership.rows.find((row) => row.userId === sessionUser.id);
    expect(
      await updateMembershipAccess({
        projectId: project.id,
        membershipId: String(owner?.id),
        access: 'VIEW',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await updateMembershipAccess({
        projectId: project.id,
        membershipId: admin.id,
        access: 'VIEW',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(owner?.access).toBe('EDIT');
    expect(db.membership.rows.find((row) => row.id === admin.id)?.access).toBe('EDIT');
  });

  it('rejects when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const result = await updateMembershipAccess({
      projectId: 'project-1',
      membershipId: 'mem-1',
      access: 'VIEW',
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('rejects an empty, oversized, or unknown access without a lookup', async () => {
    expect(
      await updateMembershipAccess({ projectId: '', membershipId: 'mem-1', access: 'VIEW' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await updateMembershipAccess({
        projectId: 'p'.repeat(MAX_ID_LENGTH + 1),
        membershipId: 'mem-1',
        access: 'VIEW',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await updateMembershipAccess({
        projectId: 'project-1',
        membershipId: 'mem-1',
        access: 'OWNER',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.membership.updateMany).not.toHaveBeenCalled();
  });
});
