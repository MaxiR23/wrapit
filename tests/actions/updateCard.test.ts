// tests/actions/updateCard.test.ts
//
// Tests for the updateCard server action.
//
// Tested:
// - Updates title and description on the owner's card
// - Rejects an empty title with a clear field error
// - Rejects updating a card the user does not own
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, invalid input, ownership, unauthorized, unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/updateCard.test.ts
//
// SEE: src/actions/updateCard.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

const { updateCard } = await import('@/actions/updateCard');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

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

describe('updateCard', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('updates title and description on the owner card', async () => {
    const { project, card } = await seedOwnedCard();

    const result = await updateCard({
      cardId: card.id,
      title: 'New title',
      description: 'New description',
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: card.id,
        title: 'New title',
        description: 'New description',
      }),
    });
    expect(db.card.rows[0]?.title).toBe('New title');
    expect(db.card.rows[0]?.description).toBe('New description');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('clears the description when it is empty', async () => {
    const { card } = await seedOwnedCard();

    const result = await updateCard({
      cardId: card.id,
      title: 'New title',
      description: '',
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'New title',
        description: null,
      }),
    });
  });

  it('rejects an empty title with a clear field error', async () => {
    const { card } = await seedOwnedCard();

    const result = await updateCard({ cardId: card.id, title: '' });

    expect(result).toEqual({ fieldErrors: { title: 'Title is required' } });
    expect(db.card.rows[0]?.title).toBe('Old title');
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

    const result = await updateCard({
      cardId: card.id,
      title: 'Hijacked',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.title).toBe('Stolen');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { card } = await seedOwnedCard();

    const result = await updateCard({ cardId: card.id, title: 'New title' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { card } = await seedOwnedCard();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.update.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await updateCard({ cardId: card.id, title: 'New title' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
