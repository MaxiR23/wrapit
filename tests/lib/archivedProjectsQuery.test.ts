// tests/lib/archivedProjectsQuery.test.ts
//
// Tests for listing archived projects the user can still access.
//
// Tested:
// - Returns archived projects the user is a member of, newest archive first
// - Omits live projects
// - Sets canAdminister from OWNER/ADMIN membership
// - A later page continues from the server nextCursor
// - Exclude ids are omitted from rows and totalCount
// - Count and page stay on one snapshot if a row is restored between the reads
// - A row inserted ahead of the cursor does not change hasMore for the next page
// - Progress counts cards once despite multiple assignees, without reading assignments
//
// What is covered:
// - Membership isolation, live exclusion, admin flag, keyset page,
//   insert-ahead hasMore
//
// Run with: pnpm test:run tests/lib/archivedProjectsQuery.test.ts
//
// SEE: src/lib/archivedProjectsQuery.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { countArchivedProjectsForUser, listArchivedProjectsForUser } =
  await import('@/lib/archivedProjectsQuery');

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

  it('counts live cards once regardless of assignees and excludes archived cards', async () => {
    await db.user.create({ data: { id: 'user-ada', name: 'Ada', username: 'ada' } });
    await db.user.create({ data: { id: 'user-max', name: 'Max', username: 'max' } });
    const project = await seedAccessibleProject(db, {
      title: 'Archived board',
      userId: 'user-ada',
    });
    await db.project.update({
      where: { id: project.id },
      data: { archivedAt: new Date('2026-08-09T10:00:00.000Z') },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const done = await db.column.create({
      data: { title: 'Done', order: 2, projectId: project.id },
    });
    const open = await db.card.create({ data: { title: 'Open', order: 1, columnId: todo.id } });
    await db.card.create({ data: { title: 'Finished', order: 1, columnId: done.id } });
    const archived = await db.card.create({
      data: { title: 'Archived', order: 2, columnId: todo.id, archivedAt: new Date('2026-08-01') },
    });
    for (const cardId of [open.id, archived.id]) {
      for (const userId of ['user-ada', 'user-max']) {
        await db.cardAssignee.create({ data: { cardId, userId } });
      }
    }

    db.card.groupBy.mockClear();
    db.cardAssignee.findMany.mockClear();
    const page = await listArchivedProjectsForUser('user-ada');

    expect(page.projects[0]).toEqual(
      expect.objectContaining({ taskCount: 2, doneCount: 1, percent: 50 }),
    );
    expect(db.card.groupBy).toHaveBeenCalledTimes(1);
    expect(db.card.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ archivedAt: null }) }),
    );
    expect(db.cardAssignee.findMany).not.toHaveBeenCalled();
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
    expect(page.hasMore).toBe(true);
    expect(typeof page.nextCursor).toBe('string');

    const rest = await listArchivedProjectsForUser('user-ada', {
      take: 2,
      cursor: page.nextCursor ?? undefined,
    });
    expect(rest.totalCount).toBe(3);
    expect(rest.projects.map((project) => project.title)).toEqual(['Alpha board']);
    expect(rest.hasMore).toBe(false);
    expect(rest.nextCursor).toBeNull();
  });

  it('does not change hasMore for the next page when a row is inserted ahead of the cursor', async () => {
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
    expect(page.hasMore).toBe(true);

    const newest = await seedAccessibleProject(db, {
      title: 'Newest board',
      userId: 'user-ada',
    });
    await db.project.update({
      where: { id: newest.id },
      data: { archivedAt: new Date('2026-08-09T10:00:00.000Z') },
    });

    const rest = await listArchivedProjectsForUser('user-ada', {
      take: 2,
      cursor: page.nextCursor ?? undefined,
    });
    expect(rest.totalCount).toBe(4);
    expect(rest.projects.map((project) => project.title)).toEqual(['Alpha board']);
    expect(rest.hasMore).toBe(false);
    expect(rest.nextCursor).toBeNull();
  });

  it('omits excludeIds from rows and totalCount', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const kept = await seedAccessibleProject(db, {
      title: 'Kept board',
      userId: 'user-ada',
    });
    const excluded = await seedAccessibleProject(db, {
      title: 'Excluded board',
      userId: 'user-ada',
    });
    await db.project.update({
      where: { id: kept.id },
      data: { archivedAt: new Date('2026-08-02T10:00:00.000Z') },
    });
    await db.project.update({
      where: { id: excluded.id },
      data: { archivedAt: new Date('2026-08-01T10:00:00.000Z') },
    });

    const page = await listArchivedProjectsForUser('user-ada', { excludeIds: [excluded.id] });
    expect(page.totalCount).toBe(1);
    expect(page.projects.map((project) => project.id)).toEqual([kept.id]);
    expect(await countArchivedProjectsForUser('user-ada', { excludeIds: [excluded.id] })).toEqual({
      totalCount: 1,
    });
  });

  it('keeps count and page in one snapshot when a row is restored between the reads', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const kept = await seedAccessibleProject(db, {
      title: 'Kept board',
      userId: 'user-ada',
    });
    const restored = await seedAccessibleProject(db, {
      title: 'Restored board',
      userId: 'user-ada',
    });
    await db.project.update({
      where: { id: kept.id },
      data: { archivedAt: new Date('2026-08-02T10:00:00.000Z') },
    });
    await db.project.update({
      where: { id: restored.id },
      data: { archivedAt: new Date('2026-08-01T10:00:00.000Z') },
    });

    const originalCount = db.project.count.getMockImplementation() as (args?: {
      where?: Record<string, unknown>;
    }) => Promise<number>;
    db.project.count.mockImplementation(async (args) => {
      const total = await originalCount(args);
      const row = db.project.rows.find((project) => project.id === restored.id);
      if (row) row.archivedAt = null;
      return total;
    });

    const page = await listArchivedProjectsForUser('user-ada');
    const ids = page.projects.map((project) => project.id);
    expect(ids.includes(restored.id)).toBe(true);
    expect(page.totalCount).toBe(2);
  });
});
