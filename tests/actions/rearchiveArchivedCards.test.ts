// tests/actions/rearchiveArchivedCards.test.ts
//
// Tests for redeeming a restore undo token.
//
// Tested:
// - Re-archives with the original archivedAt and archivedById from the token
// - Ignores a client-supplied timestamp, user id, project id, or card list
// - A token cannot be redeemed twice
// - A token from another user or another project is refused without writing
// - An expired token is refused without writing and is deleted
// - A batch rolls back entirely when one card is no longer live
// - MEMBER is refused
//
// What is covered:
// - Happy path, client metadata ignored, single-use, ownership, expiry,
//   batch atomicity, authorization
//
// Run with: pnpm test:run tests/actions/rearchiveArchivedCards.test.ts
//
// SEE: src/actions/rearchiveArchivedCards.ts

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

const { restoreArchivedCards } = await import('@/actions/restoreArchivedCards');
const { rearchiveArchivedCards } = await import('@/actions/rearchiveArchivedCards');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };
const otherUser = {
  id: 'user-other',
  email: 'other@example.com',
  name: 'Other',
  username: 'other',
};

const originalArchivedAt = new Date('2026-08-09T10:00:00.000Z');

async function seedRestoredCard(options?: { role?: 'OWNER' | 'ADMIN' | 'MEMBER' }) {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
    role: options?.role ?? 'OWNER',
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const card = await db.card.create({
    data: {
      title: 'Write tests',
      code: 'SB-1',
      order: 1,
      columnId: column.id,
      archivedAt: originalArchivedAt,
      archivedById: otherUser.id,
    },
  });
  return { project, column, card };
}

async function restoreAndGetToken() {
  const seeded = await seedRestoredCard();
  const restored = await restoreArchivedCards({
    projectId: seeded.project.id,
    cardIds: [seeded.card.id],
  });
  if ('error' in restored) {
    throw new Error(`restore failed: ${restored.error}`);
  }
  return { ...seeded, undoToken: restored.data.undoToken };
}

describe('rearchiveArchivedCards', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('re-archives with the original archivedAt and archivedById, not the actor or now', async () => {
    const { project, card, undoToken } = await restoreAndGetToken();
    const before = Date.now();

    const result = await rearchiveArchivedCards({ token: undoToken });

    expect(result).toEqual({ data: { ids: [card.id] } });
    expect(db.card.rows[0]?.archivedAt).toEqual(originalArchivedAt);
    expect((db.card.rows[0]?.archivedAt as Date).getTime()).toBe(originalArchivedAt.getTime());
    expect((db.card.rows[0]?.archivedAt as Date).getTime()).toBeLessThan(before);
    expect(db.card.rows[0]?.archivedById).toBe(otherUser.id);
    expect(db.card.rows[0]?.archivedById).not.toBe(sessionUser.id);
    expect(db.restoreUndoToken.rows).toHaveLength(0);
    expect(db.activityEvent.rows.at(-1)).toEqual(
      expect.objectContaining({ type: 'CARD_ARCHIVED', projectId: project.id }),
    );
  });

  it('ignores a client-supplied timestamp, user id, project, or card list', async () => {
    const { card, undoToken } = await restoreAndGetToken();
    const plantedAt = new Date('2020-01-01T00:00:00.000Z');
    const otherProject = await seedAccessibleProject(db, {
      title: 'Other board',
      userId: sessionUser.id,
    });
    const otherColumn = await db.column.create({
      data: { title: 'To do', order: 1, projectId: otherProject.id },
    });
    const otherCard = await db.card.create({
      data: { title: 'Leave me', code: 'OB-1', order: 1, columnId: otherColumn.id },
    });

    const result = await rearchiveArchivedCards({
      token: undoToken,
      archivedAt: plantedAt,
      archivedById: sessionUser.id,
      projectId: otherProject.id,
      cardIds: [otherCard.id],
    } as { token: string });

    expect(result).toEqual({ data: { ids: [card.id] } });
    expect(db.card.rows.find((row) => row.id === card.id)?.archivedAt).toEqual(originalArchivedAt);
    expect(db.card.rows.find((row) => row.id === card.id)?.archivedById).toBe(otherUser.id);
    expect(db.card.rows.find((row) => row.id === otherCard.id)?.archivedAt).toBeUndefined();
  });

  it('refuses a second redeem of the same token without writing again', async () => {
    const { card, undoToken } = await restoreAndGetToken();

    expect(await rearchiveArchivedCards({ token: undoToken })).toEqual({
      data: { ids: [card.id] },
    });
    const archivedAt = db.card.rows[0]?.archivedAt;

    const second = await rearchiveArchivedCards({ token: undoToken });

    expect(second).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.archivedAt).toEqual(archivedAt);
    expect(db.card.rows[0]?.archivedById).toBe(otherUser.id);
    expect(db.restoreUndoToken.rows).toHaveLength(0);
  });

  it('refuses a token that belongs to another user without writing', async () => {
    const { project, card, undoToken } = await restoreAndGetToken();
    await db.membership.create({
      data: {
        userId: otherUser.id,
        projectId: project.id,
        role: 'ADMIN',
        access: 'EDIT',
      },
    });
    getSession.mockResolvedValue({ user: otherUser });

    const result = await rearchiveArchivedCards({ token: undoToken });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows.find((row) => row.id === card.id)?.archivedAt).toBeNull();
    expect(db.restoreUndoToken.rows).toHaveLength(1);
    expect(db.restoreUndoToken.rows[0]?.id).toBe(undoToken);
  });

  it('refuses a token bound to another project without writing', async () => {
    const foreign = await seedAccessibleProject(db, {
      title: 'Foreign board',
      userId: otherUser.id,
    });
    const foreignColumn = await db.column.create({
      data: { title: 'To do', order: 1, projectId: foreign.id },
    });
    const foreignCard = await db.card.create({
      data: { title: 'Secret', code: 'FB-1', order: 1, columnId: foreignColumn.id },
    });
    await db.restoreUndoToken.create({
      data: {
        id: 'token-foreign-project',
        userId: sessionUser.id,
        projectId: foreign.id,
        expiresAt: new Date(Date.now() + 60_000),
        cards: [
          {
            id: foreignCard.id,
            archivedAt: originalArchivedAt.toISOString(),
            archivedById: otherUser.id,
          },
        ],
      },
    });

    const result = await rearchiveArchivedCards({ token: 'token-foreign-project' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows.find((row) => row.id === foreignCard.id)?.archivedAt).toBeUndefined();
    expect(db.restoreUndoToken.rows).toHaveLength(1);
  });

  it('refuses an expired token without writing and deletes it', async () => {
    const { card, undoToken } = await restoreAndGetToken();
    const token = db.restoreUndoToken.rows.find((row) => row.id === undoToken);
    if (!token) throw new Error('expected undo token');
    token.expiresAt = new Date(Date.now() - 1000);

    const result = await rearchiveArchivedCards({ token: undoToken });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows.find((row) => row.id === card.id)?.archivedAt).toBeNull();
    expect(db.restoreUndoToken.rows).toHaveLength(0);
  });

  it('rolls back the whole batch when one card is missing', async () => {
    const { card, undoToken } = await restoreAndGetToken();
    const token = db.restoreUndoToken.rows.find((row) => row.id === undoToken);
    if (!token || !Array.isArray(token.cards)) throw new Error('expected undo token cards');
    token.cards = [
      ...token.cards,
      {
        id: 'missing',
        archivedAt: originalArchivedAt.toISOString(),
        archivedById: otherUser.id,
      },
    ];

    const result = await rearchiveArchivedCards({ token: undoToken });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows.find((row) => row.id === card.id)?.archivedAt).toBeNull();
    expect(db.activityEvent.rows.filter((row) => row.type === 'CARD_ARCHIVED')).toHaveLength(0);
    expect(db.restoreUndoToken.rows).toHaveLength(1);
  });

  it('rejects a MEMBER', async () => {
    const { project, card } = await seedRestoredCard({ role: 'MEMBER' });
    await db.restoreUndoToken.create({
      data: {
        id: 'token-member',
        userId: sessionUser.id,
        projectId: project.id,
        expiresAt: new Date(Date.now() + 60_000),
        cards: [
          {
            id: card.id,
            archivedAt: originalArchivedAt.toISOString(),
            archivedById: otherUser.id,
          },
        ],
      },
    });
    await db.card.updateMany({
      where: { id: card.id },
      data: { archivedAt: null, archivedById: null },
    });

    const result = await rearchiveArchivedCards({ token: 'token-member' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.archivedAt).toBeNull();
    expect(db.restoreUndoToken.rows).toHaveLength(1);
  });
});
