// tests/actions/moveCard.test.ts
//
// Tests for the moveCard server action.
//
// Tested:
// - Moves a card to another accessible column and appends order
// - Same-column requests are a no-op
// - Rejects a second move of the same card that still names the old source
// - Rejects moving to a column on another project
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
// - Rejects an empty, oversized, or non-string id without a lookup
//
// What is covered:
// - Happy path cross-column append, no-op, occupancy guard, membership,
//   unauthorized, unexpected Prisma failure, invalid id
//
// Run with: pnpm test:run tests/actions/moveCard.test.ts
//
// SEE: src/actions/moveCard.ts

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

const { moveCard } = await import('@/actions/moveCard');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

async function seedTwoColumns() {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
  });
  const todo = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const doing = await db.column.create({
    data: { title: 'Doing', order: 2, projectId: project.id },
  });
  const cardA = await db.card.create({
    data: { title: 'Card A', description: null, code: 'SB-1', order: 1, columnId: todo.id },
  });
  const cardB = await db.card.create({
    data: { title: 'Card B', description: null, code: 'SB-2', order: 2, columnId: todo.id },
  });
  const cardC = await db.card.create({
    data: { title: 'Card C', description: null, code: 'SB-3', order: 1, columnId: doing.id },
  });
  return { project, todo, doing, cardA, cardB, cardC };
}

describe('moveCard', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('moves a card to another column and appends it', async () => {
    const { project, todo, doing, cardA, cardC } = await seedTwoColumns();

    const result = await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: doing.id,
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: cardA.id,
        columnId: doing.id,
        order: 2,
      }),
    });
    expect(db.card.rows.find((row) => row.id === cardA.id)).toEqual(
      expect.objectContaining({ columnId: doing.id, order: 2 }),
    );
    expect(db.card.rows.find((row) => row.id === cardC.id)).toEqual(
      expect.objectContaining({ columnId: doing.id, order: 1 }),
    );
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'CARD_MOVED',
        projectId: project.id,
        actorId: sessionUser.id,
        payload: expect.objectContaining({
          cardTitle: 'Card A',
          fromColumnTitle: 'To do',
          toColumnTitle: 'Doing',
        }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('is a no-op when the source and target column are the same', async () => {
    const { todo, cardA } = await seedTwoColumns();

    const result = await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: todo.id,
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: cardA.id,
        columnId: todo.id,
        order: 1,
      }),
    });
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a second move that still names the old source column', async () => {
    const { project, todo, doing, cardA } = await seedTwoColumns();
    const review = await db.column.create({
      data: { title: 'Review', order: 3, projectId: project.id },
    });

    const first = await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: doing.id,
    });
    const second = await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: review.id,
    });

    expect(first).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ columnId: doing.id }) }),
    );
    expect(second).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows.find((row) => row.id === cardA.id)).toEqual(
      expect.objectContaining({ columnId: doing.id }),
    );
  });

  it('rejects moving to a column on another project', async () => {
    const { todo, cardA } = await seedTwoColumns();
    const otherProject = await seedAccessibleProject(db, {
      title: 'Other board',
      userId: sessionUser.id,
    });
    const otherColumn = await db.column.create({
      data: { title: 'Elsewhere', order: 1, projectId: otherProject.id },
    });

    const result = await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: otherColumn.id,
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows.find((row) => row.id === cardA.id)).toEqual(
      expect.objectContaining({ columnId: todo.id, order: 1 }),
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects moving to a column the user does not own', async () => {
    const { todo, cardA } = await seedTwoColumns();
    const foreignProject = await db.project.create({
      data: { title: 'Foreign', ownerId: 'user-other' },
    });
    const foreignColumn = await db.column.create({
      data: { title: 'Stolen', order: 1, projectId: foreignProject.id },
    });

    const result = await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: foreignColumn.id,
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { todo, doing, cardA } = await seedTwoColumns();

    const result = await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: doing.id,
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { todo, doing, cardA } = await seedTwoColumns();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.updateMany.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: doing.id,
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid card or column id without a lookup', async () => {
    db.card.findFirst.mockClear();
    db.column.findFirst.mockClear();

    expect(
      await moveCard({ cardId: '', sourceColumnId: 'col-1', targetColumnId: 'col-2' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await moveCard({ cardId: '   ', sourceColumnId: 'col-1', targetColumnId: 'col-2' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await moveCard({
        cardId: 'a'.repeat(MAX_ID_LENGTH + 1),
        sourceColumnId: 'col-1',
        targetColumnId: 'col-2',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await moveCard({
        cardId: 1 as unknown as string,
        sourceColumnId: 'col-1',
        targetColumnId: 'col-2',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await moveCard({ cardId: 'card-1', sourceColumnId: '', targetColumnId: 'col-2' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await moveCard({ cardId: 'card-1', sourceColumnId: 'col-1', targetColumnId: '' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.column.findFirst).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('keeps the snapshotted column title after a rename', async () => {
    const { todo, doing, cardA } = await seedTwoColumns();

    await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: doing.id,
    });
    await db.column.update({ where: { id: todo.id }, data: { title: 'Backlog' } });

    expect(db.activityEvent.rows[0]?.payload).toEqual(
      expect.objectContaining({ fromColumnTitle: 'To do', toColumnTitle: 'Doing' }),
    );
  });

  it('rolls back the move when logging fails', async () => {
    const { todo, doing, cardA } = await seedTwoColumns();
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await moveCard({
      cardId: cardA.id,
      sourceColumnId: todo.id,
      targetColumnId: doing.id,
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.card.rows.find((row) => row.id === cardA.id)).toEqual(
      expect.objectContaining({ columnId: todo.id }),
    );
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
