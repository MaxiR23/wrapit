// tests/actions/deleteSubtask.test.ts
//
// Tests for the deleteSubtask server action.
//
// Tested:
// - Deletes a subtask via deleteMany count
// - Rejects a subtask the user does not own
// - Rejects an empty, oversized, or non-string subtask id without a lookup
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, ownership, unauthorized, unexpected Prisma failure, invalid id
//
// Run with: pnpm test:run tests/actions/deleteSubtask.test.ts
//
// SEE: src/actions/deleteSubtask.ts

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

const { deleteSubtask } = await import('@/actions/deleteSubtask');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedOwnedSubtask() {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const card = await db.card.create({
    data: { title: 'Write tests', order: 1, columnId: column.id },
  });
  const subtask = await db.subtask.create({
    data: { text: 'First step', done: false, order: 1, cardId: card.id },
  });
  return { project, column, card, subtask };
}

describe('deleteSubtask', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('deletes a subtask via deleteMany count', async () => {
    const { project, card, subtask } = await seedOwnedSubtask();
    db.subtask.deleteMany.mockClear();

    const result = await deleteSubtask({ subtaskId: subtask.id });

    expect(result).toEqual({ data: { id: subtask.id } });
    expect(db.subtask.deleteMany).toHaveBeenCalledWith({
      where: { id: subtask.id, cardId: card.id },
    });
    expect(db.subtask.rows).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects a subtask the user does not own', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });
    const subtask = await db.subtask.create({
      data: { text: 'Secret', done: false, order: 1, cardId: card.id },
    });

    const result = await deleteSubtask({ subtaskId: subtask.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.subtask.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid subtask id without a lookup', async () => {
    db.subtask.findFirst.mockClear();

    expect(await deleteSubtask({ subtaskId: '' })).toEqual({ error: 'Unauthorized' });
    expect(await deleteSubtask({ subtaskId: '   ' })).toEqual({ error: 'Unauthorized' });
    expect(await deleteSubtask({ subtaskId: 'a'.repeat(MAX_ID_LENGTH + 1) })).toEqual({
      error: 'Unauthorized',
    });
    expect(await deleteSubtask({ subtaskId: 1 as unknown as string })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.subtask.findFirst).not.toHaveBeenCalled();
    expect(db.subtask.deleteMany).not.toHaveBeenCalled();
    expect(db.subtask.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { subtask } = await seedOwnedSubtask();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.subtask.deleteMany.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await deleteSubtask({ subtaskId: subtask.id });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.subtask.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
