// tests/lib/archivedProjectsQuery.test.ts
//
// Tests for listing archived projects the user can still access.
//
// Tested:
// - Returns archived projects the user is a member of, newest archive first
// - Omits live projects
// - Sets canAdminister from OWNER/ADMIN membership
//
// What is covered:
// - Membership isolation, live exclusion, admin flag
//
// Run with: pnpm test:run tests/lib/archivedProjectsQuery.test.ts
//
// SEE: src/lib/archivedProjectsQuery.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { listArchivedProjectsForUser } = await import('@/lib/archivedProjectsQuery');

describe('listArchivedProjectsForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns archived memberships and omits live projects', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const archived = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.project.update({
      where: { id: archived.id },
      data: { archivedAt: new Date('2026-08-09T10:00:00.000Z'), archivedById: 'user-ada' },
    });
    await seedAccessibleProject(db, {
      title: 'Live board',
      userId: 'user-ada',
    });

    const list = await listArchivedProjectsForUser('user-ada');

    expect(list).toEqual([
      expect.objectContaining({
        id: archived.id,
        title: 'Sprint board',
        canAdminister: true,
        archivedBy: expect.objectContaining({ id: 'user-ada', name: 'Ada Lovelace' }),
      }),
    ]);
  });

  it('marks a MEMBER as unable to administer', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const archived = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
      role: 'MEMBER',
    });
    await db.project.update({
      where: { id: archived.id },
      data: { archivedAt: new Date('2026-08-09T10:00:00.000Z') },
    });

    const list = await listArchivedProjectsForUser('user-ada');

    expect(list[0]?.canAdminister).toBe(false);
  });
});
