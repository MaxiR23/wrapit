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
//
// What is covered:
// - Happy path, ownership isolation, empty list, project detail with cards
//
// Run with: pnpm test:run tests/lib/projects.test.ts
//
// SEE: src/lib/projects.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { listProjectsForUser, getProjectForUser } = await import('@/lib/projects');

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
