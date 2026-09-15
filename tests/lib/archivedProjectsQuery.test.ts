// tests/lib/archivedProjectsQuery.test.ts
//
// Tests for listing archived projects the user can still access.
//
// Tested:
// - Returns archived projects the user is a member of, newest archive first
// - Omits live projects
// - Sets canAdminister from OWNER/ADMIN membership
// - A later page continues from the last row's cursor
//
// What is covered:
// - Membership isolation, live exclusion, admin flag, keyset page
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
const { archivedListCursorFromItem } = await import('@/lib/archived');

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

    expect(list.projects).toEqual([
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

    expect(list.projects[0]?.canAdminister).toBe(false);
    expect(list.projects[0]).not.toHaveProperty('description');
  });

  it('continues from the last row of the previous page', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const first = await seedAccessibleProject(db, {
      title: 'Alpha board',
      userId: 'user-ada',
    });
    const second = await seedAccessibleProject(db, {
      title: 'Beta board',
      userId: 'user-ada',
    });
    const third = await seedAccessibleProject(db, {
      title: 'Gamma board',
      userId: 'user-ada',
    });
    await db.project.update({
      where: { id: first.id },
      data: { archivedAt: new Date('2026-08-01T10:00:00.000Z') },
    });
    await db.project.update({
      where: { id: second.id },
      data: { archivedAt: new Date('2026-08-02T10:00:00.000Z') },
    });
    await db.project.update({
      where: { id: third.id },
      data: { archivedAt: new Date('2026-08-03T10:00:00.000Z') },
    });

    const page = await listArchivedProjectsForUser('user-ada', { take: 2 });
    expect(page.totalCount).toBe(3);
    expect(page.projects.map((project) => project.title)).toEqual(['Gamma board', 'Beta board']);

    const last = page.projects[1];
    const rest = await listArchivedProjectsForUser('user-ada', {
      take: 2,
      cursor: last ? archivedListCursorFromItem(last) : undefined,
    });
    expect(rest.totalCount).toBe(3);
    expect(rest.projects.map((project) => project.title)).toEqual(['Alpha board']);
  });
});
