// tests/actions/updateCardField.test.ts
//
// Tests for the updateCardField server action.
//
// Tested:
// - Updates the title and returns the trimmed value
// - Rejects an empty title with a clear field error
// - Clears the description to null and returns an empty value
// - Persists a YYYY-MM-DD due date and clears it when empty
// - Rejects an invalid due date with a field error
// - Rejects updating a card the user does not own
// - Rejects the call when there is no session
// - Rejects an empty, oversized, or non-string card id without a lookup
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, invalid input, ownership, unauthorized, unexpected Prisma failure, invalid id
//
// Run with: pnpm test:run tests/actions/updateCardField.test.ts
//
// SEE: src/actions/updateCardField.ts

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

const { updateCardField } = await import('@/actions/updateCardField');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedOwnedCard() {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const card = await db.card.create({
    data: {
      title: 'Old title',
      description: 'Old description',
      order: 1,
      columnId: column.id,
    },
  });
  return { project, column, card };
}

describe('updateCardField', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('updates the title and returns the trimmed value', async () => {
    const { project, card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'title',
      value: '  New title  ',
    });

    expect(result).toEqual({ data: { value: 'New title' } });
    expect(db.card.rows[0]?.title).toBe('New title');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects an empty title with a clear field error', async () => {
    const { card } = await seedOwnedCard();

    const result = await updateCardField({ cardId: card.id, field: 'title', value: '' });

    expect(result).toEqual({ fieldErrors: { value: 'Title is required' } });
    expect(db.card.rows[0]?.title).toBe('Old title');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('writes null for an empty description and returns an empty value', async () => {
    const { project, card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'description',
      value: '   ',
    });

    expect(result).toEqual({ data: { value: '' } });
    expect(db.card.rows[0]?.description).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('persists a calendar due date and clears it when the value is empty', async () => {
    const { project, card } = await seedOwnedCard();

    const persisted = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
    });

    expect(persisted).toEqual({ data: { value: '2026-08-25' } });
    expect(db.card.rows[0]?.dueDate).toEqual(new Date(Date.UTC(2026, 7, 25)));

    const cleared = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '',
    });

    expect(cleared).toEqual({ data: { value: '' } });
    expect(db.card.rows[0]?.dueDate).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects an invalid due date with a field error', async () => {
    const { card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '25 ago',
    });

    expect(result).toEqual({ fieldErrors: { value: 'Enter a valid date' } });
    expect(db.card.rows[0]?.dueDate).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects updating a card the user does not own', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });

    const result = await updateCardField({
      cardId: card.id,
      field: 'title',
      value: 'Hijacked',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.title).toBe('Stolen');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'title',
      value: 'New title',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid card id without a lookup', async () => {
    db.card.findFirst.mockClear();

    expect(await updateCardField({ cardId: '', field: 'title', value: 'New title' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await updateCardField({ cardId: '   ', field: 'title', value: 'New title' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await updateCardField({
        cardId: 'a'.repeat(MAX_ID_LENGTH + 1),
        field: 'title',
        value: 'New title',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await updateCardField({
        cardId: 1 as unknown as string,
        field: 'title',
        value: 'New title',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { card } = await seedOwnedCard();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.updateMany.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await updateCardField({
      cardId: card.id,
      field: 'title',
      value: 'New title',
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
