// tests/actions/deleteColumn.test.ts
//
// Tests for the deleteColumn server action.
//
// Tested:
// - Deletes a column that belongs to the signed-in user's project
// - Rejects deleting a column on another user's project
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, ownership, unauthorized, unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/deleteColumn.test.ts
//
// SEE: src/actions/deleteColumn.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

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

const { deleteColumn } = await import('@/actions/deleteColumn');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

describe('deleteColumn', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('deletes a column that belongs to the signed-in user project', async () => {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });

    const result = await deleteColumn({ columnId: column.id });

    expect(result).toEqual({ data: { id: column.id } });
    expect(db.column.rows).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects deleting a column on another user project', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });

    const result = await deleteColumn({ columnId: column.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.column.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });

    const result = await deleteColumn({ columnId: column.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.column.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const project = await db.project.create({
      data: { title: 'Sprint board', ownerId: sessionUser.id },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.column.delete.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await deleteColumn({ columnId: column.id });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.column.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
