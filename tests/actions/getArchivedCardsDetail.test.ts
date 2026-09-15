// tests/actions/getArchivedCardsDetail.test.ts
//
// Tests for loading archived card details in a batch for export.
//
// Tested:
// - A member receives description, comments, and subtask text for selected cards
// - Missing session or a non-member is Unauthorized
// - Invalid ids are refused without a lookup
// - Batches larger than MAX_ARCHIVED_BATCH are refused without a lookup
//
// What is covered:
// - Happy path, unauthorized, invalid input
//
// Run with: pnpm test:run tests/actions/getArchivedCardsDetail.test.ts
//
// SEE: src/actions/getArchivedCardsDetail.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import { MAX_ARCHIVED_BATCH } from '@/lib/validation/archived';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
const getSession = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

const { getArchivedCardsDetail } = await import('@/actions/getArchivedCardsDetail');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

describe('getArchivedCardsDetail', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('returns description, comments, and subtask text for selected archived cards', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.user.create({
      data: { id: sessionUser.id, name: 'Ada Lovelace', username: 'ada' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: {
        title: 'Write tests',
        description: 'Cover the board',
        order: 1,
        columnId: column.id,
        archivedAt: new Date('2026-08-01'),
      },
    });
    await db.subtask.create({
      data: { text: 'Sketch the nav', done: true, order: 1, cardId: card.id },
    });
    await db.comment.create({
      data: {
        body: 'Keep the icon set.',
        cardId: card.id,
        authorId: sessionUser.id,
      },
    });

    const result = await getArchivedCardsDetail({
      projectId: project.id,
      cardIds: [card.id],
    });

    expect(result).toEqual({
      data: {
        [card.id]: {
          description: 'Cover the board',
          subtasks: [{ id: expect.any(String), text: 'Sketch the nav', done: true, order: 1 }],
          comments: [
            expect.objectContaining({
              body: 'Keep the icon set.',
              author: { id: sessionUser.id, name: 'Ada Lovelace', username: 'ada' },
            }),
          ],
          commentCount: 1,
        },
      },
    });
  });

  it('returns Unauthorized when there is no session', async () => {
    getSession.mockResolvedValue(null);

    expect(await getArchivedCardsDetail({ projectId: 'p1', cardIds: ['c1'] })).toEqual({
      error: 'Unauthorized',
    });
  });

  it('refuses an oversized id without a lookup', async () => {
    const result = await getArchivedCardsDetail({
      projectId: 'p'.repeat(MAX_ID_LENGTH + 1),
      cardIds: ['card-1'],
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });

  it('refuses a batch larger than MAX_ARCHIVED_BATCH without a lookup', async () => {
    const cardIds = Array.from(
      { length: MAX_ARCHIVED_BATCH + 1 },
      (_, index) => `card-${index + 1}`,
    );
    const result = await getArchivedCardsDetail({
      projectId: 'project-1',
      cardIds,
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });
});
