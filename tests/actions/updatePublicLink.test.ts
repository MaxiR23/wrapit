// tests/actions/updatePublicLink.test.ts
//
// Tests for the updatePublicLink server action.
//
// Tested:
// - An OWNER or ADMIN can persist the public-link flag
// - A MEMBER cannot toggle it
// - Rejects when there is no session
// - Rejects an empty or oversized project id without a lookup
//
// What is covered:
// - Happy path, admin-only, unauthorized, invalid id
//
// Run with: pnpm test:run tests/actions/updatePublicLink.test.ts
//
// SEE: src/actions/updatePublicLink.ts

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

const { updatePublicLink } = await import('@/actions/updatePublicLink');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

describe('updatePublicLink', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('lets an OWNER turn the public link on', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });

    const result = await updatePublicLink({ projectId: project.id, enabled: true });

    expect(result).toEqual({ data: { enabled: true } });
    expect(db.project.rows[0]?.publicLinkEnabled).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects when the actor is a MEMBER', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-owner',
      role: 'MEMBER',
    });

    const result = await updatePublicLink({ projectId: project.id, enabled: true });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows[0]?.publicLinkEnabled).toBe(false);
  });

  it('rejects when there is no session', async () => {
    getSession.mockResolvedValue(null);
    expect(await updatePublicLink({ projectId: 'project-1', enabled: true })).toEqual({
      error: 'Unauthorized',
    });
  });

  it('rejects an empty or oversized id without a lookup', async () => {
    expect(await updatePublicLink({ projectId: '', enabled: true })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await updatePublicLink({ projectId: 'p'.repeat(MAX_ID_LENGTH + 1), enabled: true }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.project.updateMany).not.toHaveBeenCalled();
  });
});
