// tests/actions/restoreArchivedCards.test.ts
//
// Tests for the restoreArchivedCards server action.
//
// Tested:
// - OWNER restores a card to its stored column and logs CARD_RESTORED
// - Restore stores pre-restore archive metadata on a server-side undo token
// - A missing column fails with the dedicated message and writes nothing
// - A batch occupancy miss restores neither card
// - MEMBER, no session, and invalid ids are refused without a lookup
//
// What is covered:
// - Happy path, missing column, batch atomicity, authorization, invalid input
//
// Run with: pnpm test:run tests/actions/restoreArchivedCards.test.ts
//
// SEE: src/actions/restoreArchivedCards.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import { MISSING_COLUMN_MESSAGE, MISSING_COLUMN_BATCH_MESSAGE } from '@/lib/messages';

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

const { restoreArchivedCards } = await import('@/actions/restoreArchivedCards');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedArchivedCard(options?: {
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
  archivedById?: string | null;
}) {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
    role: options?.role ?? 'OWNER',
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const archivedAt = new Date('2026-08-09T10:00:00.000Z');
  const card = await db.card.create({
    data: {
      title: 'Write tests',
      code: 'SB-1',
      order: 1,
      columnId: column.id,
      archivedAt,
      archivedById: options?.archivedById === undefined ? sessionUser.id : options.archivedById,
    },
  });
  return { project, column, card, archivedAt };
}

describe('restoreArchivedCards', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('clears archivedAt, keeps the stored column, logs CARD_RESTORED, and revalidates', async () => {
    const { project, column, card } = await seedArchivedCard();

    const result = await restoreArchivedCards({ projectId: project.id, cardIds: [card.id] });

    expect(result).toEqual({
      data: { ids: [card.id], undoToken: expect.any(String) },
    });
    expect(db.card.rows[0]?.archivedAt).toBeNull();
    expect(db.card.rows[0]?.archivedById).toBeNull();
    expect(db.card.rows[0]?.columnId).toBe(column.id);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'CARD_RESTORED',
        projectId: project.id,
        payload: expect.objectContaining({ cardTitle: 'Write tests', cardId: card.id }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}/archived`);
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('stores pre-restore archivedAt and archivedById on a single-use undo token', async () => {
    const { project, card, archivedAt } = await seedArchivedCard({ archivedById: 'user-other' });

    const result = await restoreArchivedCards({ projectId: project.id, cardIds: [card.id] });

    expect(result).toEqual({
      data: { ids: [card.id], undoToken: expect.any(String) },
    });
    if ('error' in result) return;
    expect(db.restoreUndoToken.rows).toEqual([
      expect.objectContaining({
        id: result.data.undoToken,
        userId: sessionUser.id,
        projectId: project.id,
        cards: [
          {
            id: card.id,
            archivedAt: archivedAt.toISOString(),
            archivedById: 'user-other',
          },
        ],
      }),
    ]);
    expect(db.restoreUndoToken.rows[0]?.expiresAt).toBeInstanceOf(Date);
  });

  it('fails with the missing-column message and writes nothing', async () => {
    const { project, card } = await seedArchivedCard();
    db.column.rows.splice(0, db.column.rows.length);

    const result = await restoreArchivedCards({ projectId: project.id, cardIds: [card.id] });

    expect(result).toEqual({ error: MISSING_COLUMN_MESSAGE });
    expect(db.card.rows[0]?.archivedAt).toBeInstanceOf(Date);
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('restores neither card when a batch occupancy misses', async () => {
    const { project, column, card } = await seedArchivedCard();
    const live = await db.card.create({
      data: {
        title: 'Still live',
        code: 'SB-2',
        order: 2,
        columnId: column.id,
      },
    });

    const result = await restoreArchivedCards({
      projectId: project.id,
      cardIds: [card.id, live.id],
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows.find((row) => row.id === card.id)?.archivedAt).toBeInstanceOf(Date);
    expect(db.card.rows.find((row) => row.id === live.id)?.archivedAt).toBeUndefined();
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('uses the batch missing-column message when any selected column is gone', async () => {
    const { project, card } = await seedArchivedCard();
    const orphan = await db.card.create({
      data: {
        title: 'Orphan',
        code: 'SB-2',
        order: 2,
        columnId: 'missing-column',
        archivedAt: new Date('2026-08-01'),
      },
    });

    const result = await restoreArchivedCards({
      projectId: project.id,
      cardIds: [card.id, orphan.id],
    });

    expect(result).toEqual({ error: MISSING_COLUMN_BATCH_MESSAGE });
    expect(db.card.rows.find((row) => row.id === card.id)?.archivedAt).toBeInstanceOf(Date);
  });

  it('rejects a MEMBER', async () => {
    const { project, card } = await seedArchivedCard({ role: 'MEMBER' });

    const result = await restoreArchivedCards({ projectId: project.id, cardIds: [card.id] });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.archivedAt).toBeInstanceOf(Date);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { project, card } = await seedArchivedCard();

    const result = await restoreArchivedCards({ projectId: project.id, cardIds: [card.id] });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });

  it('rejects invalid ids without a lookup', async () => {
    db.project.findFirst.mockClear();

    expect(await restoreArchivedCards({ projectId: '', cardIds: ['card-1'] })).toEqual({
      error: 'Unauthorized',
    });
    expect(await restoreArchivedCards({ projectId: 'proj-1', cardIds: [] })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await restoreArchivedCards({ projectId: 'a'.repeat(MAX_ID_LENGTH + 1), cardIds: ['card-1'] }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.project.findFirst).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { project, card } = await seedArchivedCard();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.updateMany.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await restoreArchivedCards({ projectId: project.id, cardIds: [card.id] });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
  });
});
