// tests/actions/moveCard.test.ts
//
// Tests for the moveCard server action.
//
// Tested:
// - Moves a card to another owned column and persists order between neighbors
// - Reorders a card within the same column and persists the new order
// - Renumbers the column with clean integers when midpoint precision is exhausted
// - Renumbers when prepend/append extremes are exhausted
// - Rejects moving to a column on another project (ownership / same-project)
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path cross-column and same-column, renumber-on-exhaust, ownership, unauthorized, unexpected Prisma failure
//
// Run with: pnpm test:run tests/actions/moveCard.test.ts
//
// SEE: src/actions/moveCard.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

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
  const project = await db.project.create({
    data: { title: 'Sprint board', ownerId: sessionUser.id },
  });
  const todo = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const doing = await db.column.create({
    data: { title: 'Doing', order: 2, projectId: project.id },
  });
  const cardA = await db.card.create({
    data: { title: 'Card A', description: null, order: 1, columnId: todo.id },
  });
  const cardB = await db.card.create({
    data: { title: 'Card B', description: null, order: 2, columnId: todo.id },
  });
  const cardC = await db.card.create({
    data: { title: 'Card C', description: null, order: 1, columnId: doing.id },
  });
  return { project, todo, doing, cardA, cardB, cardC };
}

describe('moveCard', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('moves a card to another column and persists order between neighbors', async () => {
    const { project, doing, cardA, cardC } = await seedTwoColumns();

    const result = await moveCard({
      cardId: cardA.id,
      targetColumnId: doing.id,
      beforeCardId: null,
      afterCardId: cardC.id,
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: cardA.id,
        columnId: doing.id,
        order: 0.5,
      }),
    });
    expect(db.card.rows.find((row) => row.id === cardA.id)).toEqual(
      expect.objectContaining({ columnId: doing.id, order: 0.5 }),
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('reorders a card within the same column and persists the new order', async () => {
    const { project, todo, cardA, cardB } = await seedTwoColumns();

    const result = await moveCard({
      cardId: cardA.id,
      targetColumnId: todo.id,
      beforeCardId: cardB.id,
      afterCardId: null,
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: cardA.id,
        columnId: todo.id,
        order: 3,
      }),
    });
    expect(db.card.rows.find((row) => row.id === cardA.id)).toEqual(
      expect.objectContaining({ columnId: todo.id, order: 3 }),
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('renumbers the column when midpoint precision is exhausted and keeps stable order', async () => {
    const { project, doing, cardA, cardC } = await seedTwoColumns();
    const left = await db.card.create({
      data: {
        title: 'Left',
        description: null,
        order: 2,
        columnId: doing.id,
      },
    });
    // Same order as left: no distinct midpoint exists between them.
    const right = await db.card.create({
      data: {
        title: 'Right',
        description: null,
        order: 2,
        columnId: doing.id,
      },
    });

    const result = await moveCard({
      cardId: cardA.id,
      targetColumnId: doing.id,
      beforeCardId: left.id,
      afterCardId: right.id,
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: cardA.id,
        columnId: doing.id,
        order: 3,
      }),
    });

    const doingCards = await db.card.findMany({
      where: { columnId: doing.id },
      orderBy: { order: 'asc' },
    });
    expect(doingCards.map((card) => card.order)).toEqual([1, 2, 3, 4]);
    expect(doingCards.map((card) => card.id)).toEqual([cardC.id, left.id, cardA.id, right.id]);

    // Simulate reload: orderBy order asc must yield the same sequence.
    const reloaded = await db.card.findMany({
      where: { columnId: doing.id },
      orderBy: { order: 'asc' },
    });
    expect(reloaded.map((card) => card.id)).toEqual([cardC.id, left.id, cardA.id, right.id]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('renumbers when prepend precision is exhausted at Number.MIN_VALUE', async () => {
    const { project, doing, cardA, cardC } = await seedTwoColumns();
    await db.card.update({
      where: { id: cardC.id },
      data: { order: Number.MIN_VALUE },
    });

    const result = await moveCard({
      cardId: cardA.id,
      targetColumnId: doing.id,
      beforeCardId: null,
      afterCardId: cardC.id,
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: cardA.id,
        columnId: doing.id,
        order: 1,
      }),
    });

    const doingCards = await db.card.findMany({
      where: { columnId: doing.id },
      orderBy: { order: 'asc' },
    });
    expect(doingCards.map((card) => card.id)).toEqual([cardA.id, cardC.id]);
    expect(doingCards.map((card) => card.order)).toEqual([1, 2]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('renumbers when append precision is exhausted at 2**53', async () => {
    const { project, doing, cardA, cardC } = await seedTwoColumns();
    await db.card.update({
      where: { id: cardC.id },
      data: { order: 2 ** 53 },
    });

    const result = await moveCard({
      cardId: cardA.id,
      targetColumnId: doing.id,
      beforeCardId: cardC.id,
      afterCardId: null,
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: cardA.id,
        columnId: doing.id,
        order: 2,
      }),
    });

    const doingCards = await db.card.findMany({
      where: { columnId: doing.id },
      orderBy: { order: 'asc' },
    });
    expect(doingCards.map((card) => card.id)).toEqual([cardC.id, cardA.id]);
    expect(doingCards.map((card) => card.order)).toEqual([1, 2]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects moving to a column on another project', async () => {
    const { todo, cardA } = await seedTwoColumns();
    const otherProject = await db.project.create({
      data: { title: 'Other board', ownerId: sessionUser.id },
    });
    const otherColumn = await db.column.create({
      data: { title: 'Elsewhere', order: 1, projectId: otherProject.id },
    });

    const result = await moveCard({
      cardId: cardA.id,
      targetColumnId: otherColumn.id,
      beforeCardId: null,
      afterCardId: null,
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows.find((row) => row.id === cardA.id)).toEqual(
      expect.objectContaining({ columnId: todo.id, order: 1 }),
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects moving to a column the user does not own', async () => {
    const { cardA } = await seedTwoColumns();
    const foreignProject = await db.project.create({
      data: { title: 'Foreign', ownerId: 'user-other' },
    });
    const foreignColumn = await db.column.create({
      data: { title: 'Stolen', order: 1, projectId: foreignProject.id },
    });

    const result = await moveCard({
      cardId: cardA.id,
      targetColumnId: foreignColumn.id,
      beforeCardId: null,
      afterCardId: null,
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { doing, cardA } = await seedTwoColumns();

    const result = await moveCard({
      cardId: cardA.id,
      targetColumnId: doing.id,
      beforeCardId: null,
      afterCardId: null,
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { doing, cardA } = await seedTwoColumns();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.update.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await moveCard({
      cardId: cardA.id,
      targetColumnId: doing.id,
      beforeCardId: null,
      afterCardId: null,
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
