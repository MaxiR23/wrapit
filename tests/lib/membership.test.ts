// tests/lib/membership.test.ts
//
// Tests for membership access helpers, the last-OWNER invariant, and the
// owner-membership backfill.
//
// Tested:
// - accessibleByUser returns the membership some-userId where clause
// - withBoardAccess filters by minimum board access
// - administeredByUser filters to OWNER or ADMIN
// - assertNotLastOwner throws LastOwnerError when deleting the last OWNER
// - assertNotLastOwner throws LastOwnerError when demoting the last OWNER
// - assertNotLastOwner does not throw when another OWNER remains
// - assertNotLastOwner does not throw for a non-OWNER membership
// - assertNotLastOwner does not mutate memberships when it throws
// - backfill inserts a missing OWNER row for Project.ownerId
// - backfill is idempotent
// - backfill promotes a creator MEMBER row to OWNER without duplicating
// - backfill does not promote ownerId when an OWNER already exists
//
// What is covered:
// - Access where clause, last-OWNER guard, backfill promote-then-insert
//
// Run with: pnpm test:run tests/lib/membership.test.ts
//
// SEE: src/lib/membership.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const {
  LastOwnerError,
  accessibleByUser,
  administeredByUser,
  assertNotLastOwner,
  backfillOwnerMemberships,
  withBoardAccess,
} = await import('@/lib/membership');

describe('accessibleByUser', () => {
  it('returns a membership some-filter for the given user id', () => {
    expect(accessibleByUser('user-ada')).toEqual({
      memberships: { some: { userId: 'user-ada' } },
    });
  });
});

describe('withBoardAccess', () => {
  it('filters memberships to access at least COMMENT', () => {
    expect(withBoardAccess('user-ada', 'COMMENT')).toEqual({
      memberships: { some: { userId: 'user-ada', access: { in: ['COMMENT', 'EDIT'] } } },
    });
  });

  it('filters memberships to EDIT only', () => {
    expect(withBoardAccess('user-ada', 'EDIT')).toEqual({
      memberships: { some: { userId: 'user-ada', access: { in: ['EDIT'] } } },
    });
  });
});

describe('administeredByUser', () => {
  it('filters memberships to OWNER or ADMIN', () => {
    expect(administeredByUser('user-ada')).toEqual({
      memberships: { some: { userId: 'user-ada', role: { in: ['OWNER', 'ADMIN'] } } },
    });
  });
});

describe('assertNotLastOwner', () => {
  beforeEach(() => {
    db.reset();
  });

  async function seedLastOwner() {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    const owner = await db.membership.create({
      data: {
        userId: 'user-ada',
        projectId: project.id,
        role: 'OWNER',
      },
    });
    return { project, owner };
  }

  it('throws LastOwnerError when removing the last OWNER and does not mutate', async () => {
    const { project, owner } = await seedLastOwner();

    await expect(
      assertNotLastOwner(db, { projectId: project.id, membershipId: owner.id }),
    ).rejects.toEqual(expect.any(LastOwnerError));

    expect(db.membership.rows).toHaveLength(1);
    expect(db.membership.rows[0]).toEqual(expect.objectContaining({ id: owner.id, role: 'OWNER' }));
  });

  it('throws LastOwnerError when demoting the last OWNER and does not mutate', async () => {
    const { project, owner } = await seedLastOwner();

    await expect(
      assertNotLastOwner(db, { projectId: project.id, membershipId: owner.id }),
    ).rejects.toThrow('Cannot remove the last OWNER');

    expect(db.membership.rows[0]?.role).toBe('OWNER');
  });

  it('does not throw when another OWNER remains', async () => {
    const { project, owner } = await seedLastOwner();
    await db.membership.create({
      data: {
        userId: 'user-max',
        projectId: project.id,
        role: 'OWNER',
      },
    });

    await expect(
      assertNotLastOwner(db, { projectId: project.id, membershipId: owner.id }),
    ).resolves.toBeUndefined();
    expect(db.membership.rows).toHaveLength(2);
  });

  it('does not throw for a MEMBER membership even if it is the only row', async () => {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    const member = await db.membership.create({
      data: {
        userId: 'user-max',
        projectId: project.id,
        role: 'MEMBER',
      },
    });

    await expect(
      assertNotLastOwner(db, { projectId: project.id, membershipId: member.id }),
    ).resolves.toBeUndefined();
  });
});

describe('backfillOwnerMemberships', () => {
  beforeEach(() => {
    db.reset();
  });

  it('inserts a missing OWNER membership for the current ownerId', async () => {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });

    await backfillOwnerMemberships(db);

    expect(db.membership.rows).toHaveLength(1);
    expect(db.membership.rows[0]).toEqual(
      expect.objectContaining({
        userId: 'user-ada',
        projectId: project.id,
        role: 'OWNER',
        starred: false,
      }),
    );
  });

  it('is idempotent: a second run inserts nothing', async () => {
    await db.project.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });

    await backfillOwnerMemberships(db);
    const afterFirst = db.membership.rows.map((row) => ({ ...row }));
    await backfillOwnerMemberships(db);

    expect(db.membership.rows).toHaveLength(1);
    expect(db.membership.rows).toEqual(afterFirst);
  });

  it('promotes a creator MEMBER row to OWNER without duplicating', async () => {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    await db.membership.create({
      data: {
        userId: 'user-ada',
        projectId: project.id,
        role: 'MEMBER',
        starred: true,
      },
    });

    await backfillOwnerMemberships(db);

    expect(db.membership.rows).toHaveLength(1);
    expect(db.membership.rows[0]).toEqual(
      expect.objectContaining({
        userId: 'user-ada',
        projectId: project.id,
        role: 'OWNER',
        starred: true,
      }),
    );
  });

  it('does not insert a second OWNER when the project already has one', async () => {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    await db.membership.create({
      data: {
        userId: 'user-max',
        projectId: project.id,
        role: 'OWNER',
      },
    });
    await db.membership.create({
      data: {
        userId: 'user-ada',
        projectId: project.id,
        role: 'ADMIN',
      },
    });

    await backfillOwnerMemberships(db);

    expect(db.membership.rows.filter((row) => row.role === 'OWNER')).toHaveLength(1);
    expect(db.membership.rows.find((row) => row.userId === 'user-max')?.role).toBe('OWNER');
    expect(db.membership.rows.find((row) => row.userId === 'user-ada')?.role).toBe('ADMIN');
  });
});
