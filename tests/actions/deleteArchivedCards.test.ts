// tests/actions/deleteArchivedCards.test.ts
//
// Tests for permanently deleting archived cards.
//
// Tested:
// - OWNER deletes an archived card and cascades comments and subtasks
// - Live cards are refused by occupancy
// - MEMBER is refused
// - Invalid ids are refused without a lookup
//
// What is covered:
// - Happy path, cascade, occupancy, authorization, invalid input
//
// Run with: pnpm test:run tests/actions/deleteArchivedCards.test.ts
//
// SEE: src/actions/deleteArchivedCards.ts

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

const { deleteArchivedCards } = await import('@/actions/deleteArchivedCards');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

describe('deleteArchivedCards', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('deletes an archived card and cascades comments and subtasks', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
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
        archivedAt: new Date('2026-08-01'),
      },
    });
    await db.subtask.create({
      data: { text: 'First step', done: false, order: 1, cardId: card.id },
    });
    await db.comment.create({
      data: { body: 'Looks good', cardId: card.id, authorId: sessionUser.id },
    });

    const result = await deleteArchivedCards({ projectId: project.id, cardIds: [card.id] });

    expect(result).toEqual({ data: { ids: [card.id] } });
    expect(db.card.rows).toHaveLength(0);
    expect(db.subtask.rows).toHaveLength(0);
    expect(db.comment.rows).toHaveLength(0);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'CARD_DELETED',
        projectId: project.id,
        payload: expect.objectContaining({ cardTitle: 'Write tests' }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}/archived`);
  });

  it('refuses a live card without deleting it', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Live', code: 'SB-1', order: 1, columnId: column.id },
    });

    const result = await deleteArchivedCards({ projectId: project.id, cardIds: [card.id] });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(1);
  });

  it('rejects a MEMBER', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      role: 'MEMBER',
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
        archivedAt: new Date('2026-08-01'),
      },
    });

    const result = await deleteArchivedCards({ projectId: project.id, cardIds: [card.id] });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(1);
  });

  it('rejects invalid ids without a lookup', async () => {
    db.project.findFirst.mockClear();

    expect(await deleteArchivedCards({ projectId: '', cardIds: ['card-1'] })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await deleteArchivedCards({ projectId: 'proj', cardIds: ['a'.repeat(MAX_ID_LENGTH + 1)] }),
    ).toEqual({
      error: 'Unauthorized',
    });
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });
});
