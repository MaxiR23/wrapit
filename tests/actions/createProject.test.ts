// tests/actions/createProject.test.ts
//
// Tests for the createProject server action.
//
// Tested:
// - Creates a project owned by the signed-in user on valid input
// - Title-only create stores a null description, NEW status, no membership,
//   and the three default columns in order
// - Trims and stores a description; empty or whitespace description stores null
// - Accepts NEW, IN_PROGRESS, and PAUSED; rejects DONE and unknown status
// - featured true creates a starred owner membership; false does not
// - Rejects an empty or whitespace title with a clear field error
// - Ignores a forged ownerId and always uses the session user
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
// - Rolls back the project when default column creation fails
// - Rolls back project and columns when featured membership upsert fails
//
// What is covered:
// - Happy path, default columns, description, status, featured, invalid input,
//   ownership, unauthorized, unexpected Prisma failure, transaction rollback
//
// Run with: pnpm test:run tests/actions/createProject.test.ts
//
// SEE: src/actions/createProject.ts

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

const { createProject } = await import('@/actions/createProject');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

function columnsInOrder() {
  return [...db.column.rows].sort((left, right) => Number(left.order) - Number(right.order));
}

describe('createProject', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a project owned by the signed-in user on valid input', async () => {
    const result = await createProject({ title: 'Sprint board' });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Sprint board',
        ownerId: sessionUser.id,
      }),
    });
    expect(db.project.rows).toHaveLength(1);
    expect(db.project.rows[0]?.ownerId).toBe(sessionUser.id);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('stores a null description, NEW status, no membership, and default columns for title only', async () => {
    const result = await createProject({ title: 'Sprint board' });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Sprint board',
        description: null,
        status: 'NEW',
        ownerId: sessionUser.id,
      }),
    });
    expect(db.membership.rows).toHaveLength(0);

    const columns = columnsInOrder();
    expect(columns.map((column) => ({ title: column.title, order: column.order }))).toEqual([
      { title: 'To do', order: 0 },
      { title: 'In progress', order: 1 },
      { title: 'Done', order: 2 },
    ]);
    expect(columns.every((column) => column.projectId === db.project.rows[0]?.id)).toBe(true);
  });

  it('trims and stores a description', async () => {
    const result = await createProject({
      title: 'Sprint board',
      description: '  Board for the current sprint  ',
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        description: 'Board for the current sprint',
      }),
    });
    expect(db.project.rows[0]?.description).toBe('Board for the current sprint');
  });

  it('stores null when the description is empty or whitespace', async () => {
    const empty = await createProject({ title: 'Empty desc', description: '' });
    expect(empty).toEqual({
      data: expect.objectContaining({ description: null }),
    });

    db.reset();

    const whitespace = await createProject({ title: 'Whitespace desc', description: '   ' });
    expect(whitespace).toEqual({
      data: expect.objectContaining({ description: null }),
    });
    expect(db.project.rows[0]?.description).toBeNull();
  });

  it('accepts NEW, IN_PROGRESS, and PAUSED as status', async () => {
    for (const status of ['NEW', 'IN_PROGRESS', 'PAUSED'] as const) {
      db.reset();
      const result = await createProject({ title: 'Sprint board', status });
      expect(result).toEqual({
        data: expect.objectContaining({ status }),
      });
      expect(db.project.rows[0]?.status).toBe(status);
    }
  });

  it('rejects DONE as status', async () => {
    const result = await createProject({
      title: 'Sprint board',
      status: 'DONE',
    } as { title: string });

    expect(result).toEqual({
      fieldErrors: { status: 'Status must be New, In progress, or Paused' },
    });
    expect(db.project.rows).toHaveLength(0);
    expect(db.column.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an unknown status value', async () => {
    const result = await createProject({
      title: 'Sprint board',
      status: 'GARBAGE',
    } as { title: string });

    expect(result).toEqual({
      fieldErrors: { status: 'Status must be New, In progress, or Paused' },
    });
    expect(db.project.rows).toHaveLength(0);
    expect(db.column.rows).toHaveLength(0);
  });

  it('creates a starred owner membership when featured is true', async () => {
    const result = await createProject({ title: 'Sprint board', featured: true });

    expect(result).toEqual({
      data: expect.objectContaining({ title: 'Sprint board' }),
    });
    expect(db.membership.rows).toHaveLength(1);
    expect(db.membership.rows[0]).toEqual(
      expect.objectContaining({
        userId: sessionUser.id,
        projectId: db.project.rows[0]?.id,
        role: 'OWNER',
        starred: true,
      }),
    );
  });

  it('does not create a membership when featured is false', async () => {
    await createProject({ title: 'Sprint board', featured: false });

    expect(db.membership.rows).toHaveLength(0);
  });

  it('rejects an empty title with a clear field error', async () => {
    const result = await createProject({ title: '' });

    expect(result).toEqual({ fieldErrors: { title: 'Title is required' } });
    expect(db.project.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only title with a clear field error', async () => {
    const result = await createProject({ title: '   ' });

    expect(result).toEqual({ fieldErrors: { title: 'Title is required' } });
    expect(db.project.rows).toHaveLength(0);
    expect(db.column.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('ignores a forged ownerId and always uses the session user', async () => {
    const result = await createProject({
      title: 'Stolen board',
      ownerId: otherUserId,
    } as { title: string });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Stolen board',
        ownerId: sessionUser.id,
      }),
    });
    expect(db.project.rows[0]?.ownerId).toBe(sessionUser.id);
    expect(db.project.rows[0]?.ownerId).not.toBe(otherUserId);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await createProject({ title: 'Sprint board' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.project.create.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await createProject({ title: 'Sprint board' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.project.rows).toHaveLength(0);
    expect(db.column.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back the project when default column creation fails', async () => {
    const leakyMessage = 'PrismaClientKnownRequestError: column insert failed';
    db.column.create.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await createProject({ title: 'Sprint board' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.project.rows).toHaveLength(0);
    expect(db.column.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back project and columns when featured membership upsert fails', async () => {
    const leakyMessage = 'PrismaClientKnownRequestError: membership upsert failed';
    db.membership.upsert.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await createProject({ title: 'Sprint board', featured: true });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.project.rows).toHaveLength(0);
    expect(db.column.rows).toHaveLength(0);
    expect(db.membership.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
