// tests/actions/restoreArchivedProjects.test.ts
//
// Tests for the restoreArchivedProjects server action.
//
// Tested:
// - OWNER restores archived projects, logs PROJECT_RESTORED, and mints a PROJECT undo token
// - A batch occupancy miss restores neither project
// - MEMBER, no session, and invalid ids are refused without a write
// - A membership revoked between lookup and write does not restore
//
// What is covered:
// - Happy path, batch atomicity, authorization, write-time membership, invalid input
//
// Run with: pnpm test:run tests/actions/restoreArchivedProjects.test.ts
//
// SEE: src/actions/restoreArchivedProjects.ts

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

const { restoreArchivedProjects } = await import('@/actions/restoreArchivedProjects');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedArchivedProject(options?: {
  title?: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
  archivedById?: string | null;
}) {
  const project = await seedAccessibleProject(db, {
    title: options?.title ?? 'Sprint board',
    userId: sessionUser.id,
    role: options?.role ?? 'OWNER',
  });
  const archivedAt = new Date('2026-08-09T10:00:00.000Z');
  await db.project.update({
    where: { id: project.id },
    data: {
      archivedAt,
      archivedById: options?.archivedById === undefined ? sessionUser.id : options.archivedById,
    },
  });
  return { project, archivedAt };
}

describe('restoreArchivedProjects', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('clears archive fields, logs PROJECT_RESTORED, and stores a PROJECT undo token', async () => {
    const { project, archivedAt } = await seedArchivedProject({ archivedById: 'user-other' });

    const result = await restoreArchivedProjects({ projectIds: [project.id] });

    expect(result).toEqual({
      data: { ids: [project.id], undoToken: expect.any(String) },
    });
    expect(db.project.rows[0]?.archivedAt).toBeNull();
    expect(db.project.rows[0]?.archivedById).toBeNull();
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'PROJECT_RESTORED',
        projectId: project.id,
        payload: expect.objectContaining({ projectTitle: 'Sprint board' }),
      }),
    ]);
    if ('error' in result) return;
    expect(db.restoreUndoToken.rows).toEqual([
      expect.objectContaining({
        id: result.data.undoToken,
        userId: sessionUser.id,
        projectId: project.id,
        kind: 'PROJECT',
        cards: [
          {
            id: project.id,
            archivedAt: archivedAt.toISOString(),
            archivedById: 'user-other',
          },
        ],
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/archived');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('restores neither project when one id is not archived', async () => {
    const { project: archived } = await seedArchivedProject({ title: 'Archived board' });
    const live = await seedAccessibleProject(db, {
      title: 'Live board',
      userId: sessionUser.id,
    });

    const result = await restoreArchivedProjects({
      projectIds: [archived.id, live.id],
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows.find((row) => row.id === archived.id)?.archivedAt).toBeInstanceOf(Date);
    expect(db.project.rows.find((row) => row.id === live.id)?.archivedAt).toBeUndefined();
    expect(db.restoreUndoToken.rows).toHaveLength(0);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('refuses when membership is revoked between lookup and write', async () => {
    const { project, archivedAt } = await seedArchivedProject();
    db.project.findMany.mockImplementationOnce(async (args) => {
      const result = await db.project.findMany(args);
      db.membership.rows.splice(0, db.membership.rows.length);
      return result;
    });

    const result = await restoreArchivedProjects({ projectIds: [project.id] });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows[0]?.archivedAt).toBe(archivedAt);
    expect(db.restoreUndoToken.rows).toHaveLength(0);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('refuses a MEMBER without writing', async () => {
    const { project } = await seedArchivedProject({ role: 'MEMBER' });

    const result = await restoreArchivedProjects({ projectIds: [project.id] });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows[0]?.archivedAt).toBeInstanceOf(Date);
  });

  it('refuses when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { project } = await seedArchivedProject();

    expect(await restoreArchivedProjects({ projectIds: [project.id] })).toEqual({
      error: 'Unauthorized',
    });
  });

  it('refuses an empty or oversized id without a lookup', async () => {
    expect(await restoreArchivedProjects({ projectIds: [] })).toEqual({ error: 'Unauthorized' });
    expect(await restoreArchivedProjects({ projectIds: ['a'.repeat(MAX_ID_LENGTH + 1)] })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.project.findMany).not.toHaveBeenCalled();
  });
});
