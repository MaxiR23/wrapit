// tests/actions/deleteCard.test.ts
//
// Tests for the deleteCard server action.
//
// Tested:
// - Deletes a card that belongs to the signed-in user's project
// - Deletes comments and subtasks that belong to the card
// - Rejects deleting an archived card (occupancy on archivedAt null)
// - Rejects deleting a card on another user's project
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
// - Rejects an empty, oversized, or non-string card id without a lookup
//
// What is covered:
// - Happy path, cascade delete, ownership, unauthorized, unexpected Prisma failure, invalid id
//
// Run with: pnpm test:run tests/actions/deleteCard.test.ts
//
// SEE: src/actions/deleteCard.ts

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

const { deleteCard } = await import('@/actions/deleteCard');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

describe('deleteCard', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('deletes a card that belongs to the signed-in user project', async () => {
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

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ data: { id: card.id } });
    expect(db.card.rows).toHaveLength(0);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'CARD_DELETED',
        projectId: project.id,
        payload: expect.objectContaining({ cardTitle: 'Write tests', cardId: card.id }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('deletes comments and subtasks that belong to the card', async () => {
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
    await db.subtask.create({
      data: { text: 'First step', done: false, order: 1, cardId: card.id },
    });
    await db.comment.create({
      data: { body: 'Looks good', cardId: card.id, authorId: sessionUser.id },
    });

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ data: { id: card.id } });
    expect(db.card.rows).toHaveLength(0);
    expect(db.subtask.rows).toHaveLength(0);
    expect(db.comment.rows).toHaveLength(0);
  });

  it('rejects deleting an archived card without removing it', async () => {
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
        order: 1,
        columnId: column.id,
        archivedAt: new Date('2026-08-01'),
      },
    });

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(1);
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects deleting a card on another user project', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
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

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
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
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.deleteMany.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.card.rows).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid card id without a lookup', async () => {
    db.card.findFirst.mockClear();

    expect(await deleteCard({ cardId: '' })).toEqual({ error: 'Unauthorized' });
    expect(await deleteCard({ cardId: '   ' })).toEqual({ error: 'Unauthorized' });
    expect(await deleteCard({ cardId: 'a'.repeat(MAX_ID_LENGTH + 1) })).toEqual({
      error: 'Unauthorized',
    });
    expect(await deleteCard({ cardId: 1 as unknown as string })).toEqual({ error: 'Unauthorized' });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.card.deleteMany).not.toHaveBeenCalled();
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back the delete when logging fails', async () => {
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
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await deleteCard({ cardId: card.id });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.card.rows).toHaveLength(1);
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
