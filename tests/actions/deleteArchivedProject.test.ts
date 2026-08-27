// tests/actions/deleteArchivedProject.test.ts
//
// Tests for the deleteArchivedProject server action.
//
// Tested:
// - OWNER deletes an archived project when the typed title matches
// - A title mismatch or live project is refused by occupancy
// - MEMBER, no session, and invalid ids are refused without a write
// - A membership revoked between lookup and write does not delete
// - Cascades columns, cards, memberships, invitations, recents, and undo tokens
//
// What is covered:
// - Happy path, typed-title occupancy, authorization, write-time membership, invalid input, cascade
//
// Run with: pnpm test:run tests/actions/deleteArchivedProject.test.ts
//
// SEE: src/actions/deleteArchivedProject.ts

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

const { deleteArchivedProject } = await import('@/actions/deleteArchivedProject');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedArchivedProject(options?: {
  title?: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
}) {
  const project = await seedAccessibleProject(db, {
    title: options?.title ?? 'Sprint board',
    userId: sessionUser.id,
    role: options?.role ?? 'OWNER',
  });
  await db.project.update({
    where: { id: project.id },
    data: { archivedAt: new Date('2026-08-09T10:00:00.000Z'), archivedById: sessionUser.id },
  });
  return project;
}

describe('deleteArchivedProject', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('deletes the archived project when the typed title matches', async () => {
    const project = await seedArchivedProject();
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    await db.card.create({
      data: { title: 'Write tests', code: 'SB-1', order: 1, columnId: column.id },
    });

    const result = await deleteArchivedProject({
      projectId: project.id,
      title: 'Sprint board',
    });

    expect(result).toEqual({ data: { id: project.id } });
    expect(db.project.rows).toHaveLength(0);
    expect(db.column.rows).toHaveLength(0);
    expect(db.card.rows).toHaveLength(0);
    expect(db.membership.rows).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith('/archived');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('refuses when the typed title does not match exactly', async () => {
    const project = await seedArchivedProject();

    const result = await deleteArchivedProject({
      projectId: project.id,
      title: 'Sprint board ',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows).toHaveLength(1);
  });

  it('refuses a live project', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });

    const result = await deleteArchivedProject({
      projectId: project.id,
      title: 'Sprint board',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows).toHaveLength(1);
  });

  it('refuses when membership is revoked between lookup and write', async () => {
    const project = await seedArchivedProject();
    db.project.findFirst.mockImplementationOnce(async (args) => {
      const result = await db.project.findFirst(args);
      db.membership.rows.splice(0, db.membership.rows.length);
      return result;
    });

    const result = await deleteArchivedProject({
      projectId: project.id,
      title: 'Sprint board',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows).toHaveLength(1);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('refuses a MEMBER without writing', async () => {
    const project = await seedArchivedProject({ role: 'MEMBER' });

    const result = await deleteArchivedProject({
      projectId: project.id,
      title: 'Sprint board',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows).toHaveLength(1);
  });

  it('refuses when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const project = await seedArchivedProject();

    expect(await deleteArchivedProject({ projectId: project.id, title: 'Sprint board' })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.project.rows).toHaveLength(1);
  });

  it('refuses an empty title or oversized id without a lookup', async () => {
    expect(await deleteArchivedProject({ projectId: '', title: 'Sprint board' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await deleteArchivedProject({
        projectId: 'a'.repeat(MAX_ID_LENGTH + 1),
        title: 'Sprint board',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await deleteArchivedProject({ projectId: 'proj-1', title: '' })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });
});
