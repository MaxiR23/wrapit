// tests/actions/createSubtask.test.ts
//
// Tests for the createSubtask server action.
//
// Tested:
// - Appends order as max+1 (empty column → 1) with done false
// - Rejects empty text with a clear field error
// - Rejects an empty, oversized, or non-string card id without a lookup
// - Rejects a card the user does not own
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, invalid input, ownership, unauthorized, unexpected Prisma failure, invalid id
//
// Run with: pnpm test:run tests/actions/createSubtask.test.ts
//
// SEE: src/actions/createSubtask.ts

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

const { createSubtask } = await import('@/actions/createSubtask');

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
    data: { title: 'Write tests', order: 1, columnId: column.id },
  });
  return { project, column, card };
}

describe('createSubtask', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('assigns order 1 and done false when the card has no subtasks yet', async () => {
    const { project, card } = await seedOwnedCard();

    const result = await createSubtask({ cardId: card.id, text: 'First step' });

    expect(result).toEqual({
      data: expect.objectContaining({
        text: 'First step',
        done: false,
        order: 1,
        cardId: card.id,
      }),
    });
    expect(db.subtask.rows).toHaveLength(1);
    expect(db.subtask.rows[0]?.done).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('appends order as max plus one', async () => {
    const { card } = await seedOwnedCard();
    await db.subtask.create({
      data: { text: 'Earlier', done: false, order: 2, cardId: card.id },
    });

    const result = await createSubtask({ cardId: card.id, text: 'Next step' });

    expect(result).toEqual({
      data: expect.objectContaining({
        text: 'Next step',
        done: false,
        order: 3,
        cardId: card.id,
      }),
    });
    expect(db.subtask.rows).toHaveLength(2);
  });

  it('rejects empty text with a clear field error', async () => {
    const { card } = await seedOwnedCard();

    const result = await createSubtask({ cardId: card.id, text: '' });

    expect(result).toEqual({ fieldErrors: { text: 'Text is required' } });
    expect(db.subtask.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid card id without a lookup', async () => {
    db.card.findFirst.mockClear();

    expect(await createSubtask({ cardId: '', text: 'First step' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await createSubtask({ cardId: '   ', text: 'First step' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await createSubtask({ cardId: 'a'.repeat(MAX_ID_LENGTH + 1), text: 'First step' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await createSubtask({ cardId: 1 as unknown as string, text: 'First step' })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.subtask.create).not.toHaveBeenCalled();
    expect(db.subtask.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects creating on a card the user does not own', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });

    const result = await createSubtask({ cardId: card.id, text: 'Hijacked' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.subtask.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { card } = await seedOwnedCard();

    const result = await createSubtask({ cardId: card.id, text: 'First step' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.subtask.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { card } = await seedOwnedCard();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.subtask.create.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await createSubtask({ cardId: card.id, text: 'First step' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.subtask.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
