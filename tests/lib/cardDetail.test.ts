// tests/lib/cardDetail.test.ts
//
// Tests for loading card description, subtasks, and comments on demand.
//
// Tested:
// - Returns ordered subtasks and comments with author for a member
// - Orders comments by createdAt even when a later editedAt is present
// - Returns null for a non-member
//
// What is covered:
// - VIEW access chain, comment order, membership isolation
//
// Run with: pnpm test:run tests/lib/cardDetail.test.ts
//
// SEE: src/lib/cardDetail.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { getCardDetailForUser } = await import('@/lib/cardDetail');

describe('getCardDetailForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns ordered subtasks and comments with author', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'First', description: 'Cover the board', order: 1, columnId: todo.id },
    });
    await db.subtask.create({
      data: { text: 'Later', done: false, order: 2, cardId: card.id },
    });
    await db.subtask.create({
      data: { text: 'First step', done: true, order: 1, cardId: card.id },
    });
    await db.comment.create({
      data: {
        body: 'Second note',
        cardId: card.id,
        authorId: 'user-ada',
        createdAt: new Date('2026-08-02'),
      },
    });
    await db.comment.create({
      data: {
        body: 'First note',
        cardId: card.id,
        authorId: 'user-ada',
        createdAt: new Date('2026-08-01'),
      },
    });

    const detail = await getCardDetailForUser(card.id, 'user-ada');

    expect(detail?.description).toBe('Cover the board');
    expect(detail?.subtasks.map((subtask) => subtask.text)).toEqual(['First step', 'Later']);
    expect(detail?.comments.map((comment) => comment.body)).toEqual(['First note', 'Second note']);
    expect(detail?.comments[0]?.editedAt).toBeNull();
    expect(detail?.comments[0]?.author).toEqual({
      id: 'user-ada',
      name: 'Ada Lovelace',
      username: 'ada',
    });
  });

  it('orders comments by createdAt even when editedAt is later', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'First', order: 1, columnId: todo.id },
    });
    await db.comment.create({
      data: {
        body: 'Edited first',
        cardId: card.id,
        authorId: 'user-ada',
        createdAt: new Date('2026-08-01'),
        editedAt: new Date('2026-08-20'),
      },
    });
    await db.comment.create({
      data: {
        body: 'Second note',
        cardId: card.id,
        authorId: 'user-ada',
        createdAt: new Date('2026-08-02'),
      },
    });

    const detail = await getCardDetailForUser(card.id, 'user-ada');

    expect(detail?.comments.map((comment) => comment.body)).toEqual([
      'Edited first',
      'Second note',
    ]);
    expect(detail?.comments[0]?.editedAt).toEqual(new Date('2026-08-20'));
  });

  it('returns null for a non-member', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'First', order: 1, columnId: todo.id },
    });

    expect(await getCardDetailForUser(card.id, 'user-other')).toBeNull();
  });
});
