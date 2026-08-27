// tests/actions/archiveProject.test.ts
//
// Tests for the archiveProject server action.
//
// Tested:
// - OWNER archives a live project, logs PROJECT_ARCHIVED, and revalidates
// - ADMIN can archive
// - A second archive of the same project is refused by occupancy
// - MEMBER, no session, and invalid ids are refused without a write
// - A membership revoked between lookup and write does not archive
//
// What is covered:
// - Happy path, occupancy, authorization, write-time membership, invalid input
//
// Run with: pnpm test:run tests/actions/archiveProject.test.ts
//
// SEE: src/actions/archiveProject.ts

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

const { archiveProject } = await import('@/actions/archiveProject');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

describe('archiveProject', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('sets archivedAt, logs PROJECT_ARCHIVED, and revalidates', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });

    const result = await archiveProject({ projectId: project.id });

    expect(result).toEqual({ data: { id: project.id } });
    expect(db.project.rows[0]?.archivedAt).toBeInstanceOf(Date);
    expect(db.project.rows[0]?.archivedById).toBe(sessionUser.id);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'PROJECT_ARCHIVED',
        projectId: project.id,
        payload: expect.objectContaining({ projectTitle: 'Sprint board' }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
    expect(revalidatePath).toHaveBeenCalledWith('/archived');
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('lets an ADMIN archive', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      role: 'ADMIN',
    });

    const result = await archiveProject({ projectId: project.id });

    expect(result).toEqual({ data: { id: project.id } });
    expect(db.project.rows[0]?.archivedAt).toBeInstanceOf(Date);
  });

  it('refuses a second archive of the same project', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await archiveProject({ projectId: project.id });
    const archivedAt = db.project.rows[0]?.archivedAt;

    const result = await archiveProject({ projectId: project.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows[0]?.archivedAt).toBe(archivedAt);
    expect(db.activityEvent.rows).toHaveLength(1);
  });

  it('refuses when membership is revoked between lookup and write', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    db.project.findFirst.mockImplementationOnce(async (args) => {
      const result = await db.project.findFirst(args);
      db.membership.rows.splice(0, db.membership.rows.length);
      return result;
    });

    const result = await archiveProject({ projectId: project.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows[0]?.archivedAt).toBeUndefined();
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('refuses a MEMBER without writing', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      role: 'MEMBER',
    });

    const result = await archiveProject({ projectId: project.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows[0]?.archivedAt).toBeUndefined();
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('refuses when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });

    expect(await archiveProject({ projectId: project.id })).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows[0]?.archivedAt).toBeUndefined();
  });

  it('refuses an empty or oversized id without a lookup', async () => {
    expect(await archiveProject({ projectId: '' })).toEqual({ error: 'Unauthorized' });
    expect(await archiveProject({ projectId: 'a'.repeat(MAX_ID_LENGTH + 1) })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });
});
