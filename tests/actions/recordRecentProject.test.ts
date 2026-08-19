// tests/actions/recordRecentProject.test.ts
//
// Tests for the recordRecentProject server action.
//
// Tested:
// - Creates a RecentProject row the first time the user opens a project
// - Updates openedAt when the row already exists
// - No-ops when the user is not a member
// - Records a recent when the user is a member but not the creator
// - No-ops when there is no session
// - No-ops when getSession rejects
// - No-ops when Prisma fails unexpectedly
//
// What is covered:
// - Happy path create and update, no access, unauthorized, session lookup failure,
//   unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/recordRecentProject.test.ts
//
// SEE: src/actions/recordRecentProject.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
const getSession = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

const { recordRecentProject } = await import('@/actions/recordRecentProject');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

describe('recordRecentProject', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a RecentProject row the first time the user opens a project they own', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });

    await recordRecentProject(project.id);

    expect(db.recentProject.rows).toHaveLength(1);
    expect(db.recentProject.rows[0]).toEqual(
      expect.objectContaining({
        userId: sessionUser.id,
        projectId: project.id,
      }),
    );
    expect(db.recentProject.rows[0]?.openedAt).toBeInstanceOf(Date);
  });

  it('updates openedAt when the RecentProject row already exists', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const openedAt = new Date('2026-01-01T00:00:00.000Z');
    await db.recentProject.create({
      data: {
        userId: sessionUser.id,
        projectId: project.id,
        openedAt,
      },
    });

    await recordRecentProject(project.id);

    expect(db.recentProject.rows).toHaveLength(1);
    const nextOpenedAt = db.recentProject.rows[0]?.openedAt;
    expect(nextOpenedAt).toBeInstanceOf(Date);
    expect((nextOpenedAt as Date).getTime()).toBeGreaterThan(openedAt.getTime());
  });

  it('records a recent when the user is a member but not the creator', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Shared board',
      userId: sessionUser.id,
      ownerId: 'user-other',
      role: 'MEMBER',
    });

    await recordRecentProject(project.id);

    expect(db.recentProject.rows).toHaveLength(1);
    expect(db.recentProject.rows[0]).toEqual(
      expect.objectContaining({
        userId: sessionUser.id,
        projectId: project.id,
      }),
    );
  });

  it('does nothing when the user cannot access the project', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    await recordRecentProject(project.id);

    expect(db.recentProject.rows).toHaveLength(0);
  });

  it('does nothing when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });

    await expect(recordRecentProject(project.id)).resolves.toBeUndefined();
    expect(db.recentProject.rows).toHaveLength(0);
  });

  it('does nothing when getSession rejects', async () => {
    getSession.mockRejectedValueOnce(new Error('auth unavailable'));
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });

    await expect(recordRecentProject(project.id)).resolves.toBeUndefined();
    expect(db.recentProject.rows).toHaveLength(0);
  });

  it('does nothing when Prisma fails unexpectedly', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.recentProject.upsert.mockRejectedValueOnce(new Error(leakyMessage));

    await expect(recordRecentProject(project.id)).resolves.toBeUndefined();
    expect(db.recentProject.rows).toHaveLength(0);
  });
});
