// tests/actions/updateSubtaskField.test.ts
//
// Tests for the updateSubtaskField server action.
//
// Tested:
// - Renames text and returns the value
// - Sets done to the intended boolean via updateMany, without flipping
// - Rejects empty text with a clear field error
// - Rejects a subtask the user does not own
// - Rejects an empty, oversized, or non-string subtask id without a lookup
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, intended boolean, invalid input, ownership, unauthorized, unexpected Prisma failure, invalid id
//
// Run with: pnpm test:run tests/actions/updateSubtaskField.test.ts
//
// SEE: src/actions/updateSubtaskField.ts

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

const { updateSubtaskField } = await import('@/actions/updateSubtaskField');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedOwnedSubtask(data: Record<string, unknown> = {}) {
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
    data: {
      text: 'First step',
      done: false,
      order: 1,
      cardId: card.id,
      ...data,
    },
  });
  return { project, column, card, subtask };
}

describe('updateSubtaskField', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('renames text and returns the value', async () => {
    const { project, subtask } = await seedOwnedSubtask();

    const result = await updateSubtaskField({
      subtaskId: subtask.id,
      field: 'text',
      value: 'Renamed step',
    });

    expect(result).toEqual({ data: { value: 'Renamed step' } });
    expect(db.subtask.rows[0]?.text).toBe('Renamed step');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('sets done to the intended boolean via updateMany', async () => {
    const { card, subtask } = await seedOwnedSubtask({ done: false });
    db.subtask.updateMany.mockClear();

    expect(await updateSubtaskField({ subtaskId: subtask.id, field: 'done', value: true })).toEqual(
      { data: { value: true } },
    );
    expect(db.subtask.updateMany).toHaveBeenCalledWith({
      where: { id: subtask.id, cardId: card.id },
      data: { done: true },
    });
    expect(db.subtask.rows[0]?.done).toBe(true);

    expect(
      await updateSubtaskField({ subtaskId: subtask.id, field: 'done', value: false }),
    ).toEqual({ data: { value: false } });
    expect(db.subtask.rows[0]?.done).toBe(false);

    expect(await updateSubtaskField({ subtaskId: subtask.id, field: 'done', value: true })).toEqual(
      { data: { value: true } },
    );
    expect(await updateSubtaskField({ subtaskId: subtask.id, field: 'done', value: true })).toEqual(
      { data: { value: true } },
    );
    expect(db.subtask.rows[0]?.done).toBe(true);
  });

  it('rejects empty text with a clear field error', async () => {
    const { subtask } = await seedOwnedSubtask();

    const result = await updateSubtaskField({
      subtaskId: subtask.id,
      field: 'text',
      value: '',
    });

    expect(result).toEqual({ fieldErrors: { value: 'Text is required' } });
    expect(db.subtask.rows[0]?.text).toBe('First step');
    expect(revalidatePath).not.toHaveBeenCalled();
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

    const result = await updateSubtaskField({
      subtaskId: subtask.id,
      field: 'text',
      value: 'Hijacked',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.subtask.rows[0]?.text).toBe('Secret');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid subtask id without a lookup', async () => {
    db.subtask.findFirst.mockClear();

    expect(await updateSubtaskField({ subtaskId: '', field: 'text', value: 'Renamed' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await updateSubtaskField({ subtaskId: '   ', field: 'text', value: 'Renamed' })).toEqual(
      { error: 'Unauthorized' },
    );
    expect(
      await updateSubtaskField({
        subtaskId: 'a'.repeat(MAX_ID_LENGTH + 1),
        field: 'text',
        value: 'Renamed',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await updateSubtaskField({
        subtaskId: 1 as unknown as string,
        field: 'text',
        value: 'Renamed',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.subtask.findFirst).not.toHaveBeenCalled();
    expect(db.subtask.updateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { subtask } = await seedOwnedSubtask();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.subtask.updateMany.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await updateSubtaskField({
      subtaskId: subtask.id,
      field: 'text',
      value: 'Renamed step',
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
