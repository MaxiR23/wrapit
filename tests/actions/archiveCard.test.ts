// tests/actions/archiveCard.test.ts
//
// Tests for the archiveCard server action.
//
// Tested:
// - Sets archivedAt, returns the card id, and revalidates
// - Rejects an already archived card without changing it
// - Rejects a card the user does not own
// - Rejects the call when there is no session
// - Rejects an empty, oversized, or non-string card id without a lookup
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, already archived, ownership, unauthorized, unexpected Prisma failure, invalid id
//
// Run with: pnpm test:run tests/actions/archiveCard.test.ts
//
// SEE: src/actions/archiveCard.ts

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

const { archiveCard } = await import('@/actions/archiveCard');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedOwnedCard(data: Record<string, unknown> = {}) {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const card = await db.card.create({
    data: { title: 'Write tests', order: 1, columnId: column.id, ...data },
  });
  return { project, column, card };
}

describe('archiveCard', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('sets archivedAt, returns the card id, and revalidates', async () => {
    const { project, card } = await seedOwnedCard();

    const result = await archiveCard({ cardId: card.id });

    expect(result).toEqual({ data: { id: card.id } });
    expect(db.card.rows[0]?.archivedAt).toBeInstanceOf(Date);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'CARD_ARCHIVED',
        projectId: project.id,
        payload: expect.objectContaining({ cardTitle: 'Write tests' }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects an already archived card without changing it', async () => {
    const archivedAt = new Date('2026-08-01');
    const { card } = await seedOwnedCard({ archivedAt });

    const result = await archiveCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.archivedAt).toEqual(archivedAt);
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects archiving a card the user does not own', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });

    const result = await archiveCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.archivedAt).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { card } = await seedOwnedCard();

    const result = await archiveCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.archivedAt).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid card id without a lookup', async () => {
    db.card.findFirst.mockClear();

    expect(await archiveCard({ cardId: '' })).toEqual({ error: 'Unauthorized' });
    expect(await archiveCard({ cardId: '   ' })).toEqual({ error: 'Unauthorized' });
    expect(await archiveCard({ cardId: 'a'.repeat(MAX_ID_LENGTH + 1) })).toEqual({
      error: 'Unauthorized',
    });
    expect(await archiveCard({ cardId: 1 as unknown as string })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { card } = await seedOwnedCard();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.updateMany.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await archiveCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.card.rows[0]?.archivedAt).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back the archive when logging fails', async () => {
    const { card } = await seedOwnedCard();
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await archiveCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.card.rows[0]?.archivedAt).toBeUndefined();
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
