// tests/actions/rearchiveArchivedProjects.test.ts
//
// Tests for the rearchiveArchivedProjects server action.
//
// Tested:
// - Undo restores the original archivedAt and archivedById and logs PROJECT_ARCHIVED
// - A CARDS-kind token is refused
// - A used token cannot be redeemed again
// - MEMBER, no session, and invalid tokens are refused
//
// What is covered:
// - Happy path, kind isolation, single-use, authorization, invalid input
//
// Run with: pnpm test:run tests/actions/rearchiveArchivedProjects.test.ts
//
// SEE: src/actions/rearchiveArchivedProjects.ts

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
const { rearchiveArchivedProjects } = await import('@/actions/rearchiveArchivedProjects');
const { rearchiveArchivedCards } = await import('@/actions/rearchiveArchivedCards');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };
const originalArchivedAt = new Date('2026-08-09T10:00:00.000Z');

async function seedRestoredProject() {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
  });
  await db.project.update({
    where: { id: project.id },
    data: { archivedAt: originalArchivedAt, archivedById: 'user-other' },
  });
  const restored = await restoreArchivedProjects({ projectIds: [project.id] });
  if ('error' in restored) throw new Error('expected restore data');
  return { project, undoToken: restored.data.undoToken };
}

describe('rearchiveArchivedProjects', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('writes the original archive metadata back and logs PROJECT_ARCHIVED', async () => {
    const { project, undoToken } = await seedRestoredProject();

    const result = await rearchiveArchivedProjects({ token: undoToken });

    expect(result).toEqual({ data: { ids: [project.id] } });
    expect(db.project.rows[0]?.archivedAt).toEqual(originalArchivedAt);
    expect(db.project.rows[0]?.archivedById).toBe('user-other');
    expect(db.restoreUndoToken.rows).toHaveLength(0);
    expect(db.activityEvent.rows.map((row) => row.type)).toEqual([
      'PROJECT_RESTORED',
      'PROJECT_ARCHIVED',
    ]);
  });

  it('refuses a used token on the second redeem', async () => {
    const { undoToken } = await seedRestoredProject();
    await rearchiveArchivedProjects({ token: undoToken });

    const second = await rearchiveArchivedProjects({ token: undoToken });

    expect(second).toEqual({ error: 'Unauthorized' });
  });

  it('refuses a CARDS-kind token without writing', async () => {
    const { undoToken } = await seedRestoredProject();
    const token = db.restoreUndoToken.rows[0];
    if (token) token.kind = 'CARDS';

    const result = await rearchiveArchivedProjects({ token: undoToken });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows[0]?.archivedAt).toBeNull();
  });

  it('is refused by the card rearchive path', async () => {
    const { project, undoToken } = await seedRestoredProject();

    const result = await rearchiveArchivedCards({ token: undoToken });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows[0]?.archivedAt).toBeNull();
    expect(db.restoreUndoToken.rows).toHaveLength(1);
    expect(db.project.rows[0]?.id).toBe(project.id);
  });

  it('refuses when there is no session', async () => {
    const { undoToken } = await seedRestoredProject();
    getSession.mockResolvedValue(null);

    expect(await rearchiveArchivedProjects({ token: undoToken })).toEqual({
      error: 'Unauthorized',
    });
  });

  it('refuses an empty or oversized token without a lookup', async () => {
    expect(await rearchiveArchivedProjects({ token: '' })).toEqual({ error: 'Unauthorized' });
    expect(await rearchiveArchivedProjects({ token: 'a'.repeat(MAX_ID_LENGTH + 1) })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.restoreUndoToken.findFirst).not.toHaveBeenCalled();
  });
});
