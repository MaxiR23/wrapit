// tests/lib/projects.test.ts
//
// Tests for listing projects and loading a single project for a user.
//
// Tested:
// - Returns only projects owned by the given user
// - Returns projects newest first
// - Returns an empty list when the user has no projects
// - Returns the project with columns in order for the owner
// - Returns each column with its cards in order
// - Returns null for a non-owner or unknown project id
// - Summaries include computed progress, owner avatars, and 0 of 0
//
// What is covered:
// - Happy path, ownership isolation, empty list, project detail with cards,
//   grid summaries
//
// Run with: pnpm test:run tests/lib/projects.test.ts
//
// SEE: src/lib/projects.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { listProjectsForUser, getProjectForUser, listProjectSummariesForUser } =
  await import('@/lib/projects');

describe('listProjectsForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns only projects owned by the given user', async () => {
    await db.project.create({
      data: { title: 'Ada board', ownerId: 'user-ada', createdAt: new Date('2026-01-01') },
    });
    await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other', createdAt: new Date('2026-01-02') },
    });

    const projects = await listProjectsForUser('user-ada');

    expect(projects).toHaveLength(1);
    expect(projects[0]?.title).toBe('Ada board');
    expect(projects.every((project) => project.ownerId === 'user-ada')).toBe(true);
  });

  it('returns projects newest first', async () => {
    await db.project.create({
      data: { title: 'Older', ownerId: 'user-ada', createdAt: new Date('2026-01-01') },
    });
    await db.project.create({
      data: { title: 'Newer', ownerId: 'user-ada', createdAt: new Date('2026-06-01') },
    });

    const projects = await listProjectsForUser('user-ada');

    expect(projects.map((project) => project.title)).toEqual(['Newer', 'Older']);
  });

  it('returns an empty list when the user has no projects', async () => {
    await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    expect(await listProjectsForUser('user-ada')).toEqual([]);
  });
});

describe('getProjectForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns the project with columns in order for the owner', async () => {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    await db.column.create({
      data: { title: 'Done', order: 2, projectId: project.id },
    });
    await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });

    const result = await getProjectForUser(project.id, 'user-ada');

    expect(result).toEqual(
      expect.objectContaining({
        id: project.id,
        title: 'Sprint board',
        ownerId: 'user-ada',
      }),
    );
    expect(result?.columns.map((column) => column.title)).toEqual(['To do', 'Done']);
    expect(result?.columns.every((column) => column.cards.length === 0)).toBe(true);
  });

  it('returns each column with its cards in order', async () => {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: 'user-ada' },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const done = await db.column.create({
      data: { title: 'Done', order: 2, projectId: project.id },
    });
    await db.card.create({
      data: { title: 'Second', order: 2, columnId: todo.id },
    });
    await db.card.create({
      data: { title: 'First', order: 1, columnId: todo.id },
    });
    await db.card.create({
      data: { title: 'Finished', order: 1, columnId: done.id },
    });

    const result = await getProjectForUser(project.id, 'user-ada');

    expect(result?.columns[0]?.cards.map((card) => card.title)).toEqual(['First', 'Second']);
    expect(result?.columns[1]?.cards.map((card) => card.title)).toEqual(['Finished']);
  });

  it('returns null for a non-owner', async () => {
    const project = await db.project.create({
      data: { title: 'Ada board', ownerId: 'user-ada' },
    });

    expect(await getProjectForUser(project.id, 'user-other')).toBeNull();
  });

  it('returns null for an unknown project id', async () => {
    expect(await getProjectForUser('missing-project', 'user-ada')).toBeNull();
  });
});

describe('listProjectSummariesForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns computed progress, members, and status for owned projects', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const project = await db.project.create({
      data: {
        title: 'Sprint board',
        ownerId: 'user-ada',
        status: 'IN_PROGRESS',
        createdAt: new Date('2026-01-01'),
      },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const done = await db.column.create({
      data: { title: 'Done', order: 2, projectId: project.id },
    });
    await db.card.create({
      data: { title: 'Open', order: 1, columnId: todo.id, updatedAt: new Date('2026-02-01') },
    });
    await db.card.create({
      data: { title: 'Finished', order: 1, columnId: done.id, updatedAt: new Date('2026-03-01') },
    });
    await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, starred: false },
    });

    const summaries = await listProjectSummariesForUser('user-ada');

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toEqual(
      expect.objectContaining({
        id: project.id,
        title: 'Sprint board',
        status: 'IN_PROGRESS',
        statusLabel: 'In progress',
        taskCount: 2,
        doneCount: 1,
        percent: 50,
        starred: false,
      }),
    );
    expect(summaries[0]?.members.map((member) => member.initials)).toEqual(['AL', 'MA']);
  });

  it('returns 0 of 0 and 0% when the project has no cards', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    await db.project.create({
      data: { title: 'Empty board', ownerId: 'user-ada', status: 'NEW' },
    });

    const summaries = await listProjectSummariesForUser('user-ada');

    expect(summaries[0]).toEqual(
      expect.objectContaining({
        title: 'Empty board',
        taskCount: 0,
        doneCount: 0,
        percent: 0,
        statusLabel: 'New',
      }),
    );
    expect(summaries[0]?.members).toEqual([
      { id: 'user-ada', name: 'Ada Lovelace', initials: 'AL' },
    ]);
  });

  it('does not include projects owned by someone else', async () => {
    await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    expect(await listProjectSummariesForUser('user-ada')).toEqual([]);
  });
});
