// tests/actions/boardAccess.test.ts
//
// Tests that board actions enforce Membership.access.
//
// Tested:
// - EDIT can create a card
// - COMMENT cannot create, move, archive, delete, or rename a card or subtask
// - COMMENT can comment, edit their own comment, and check a subtask
// - VIEW cannot comment, edit a comment, or check a subtask
//
// What is covered:
// - Access denials and COMMENT-level writes
//
// Run with: pnpm test:run tests/actions/boardAccess.test.ts
//
// SEE: src/lib/membership.ts

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

const { createCard } = await import('@/actions/createCard');
const { moveCard } = await import('@/actions/moveCard');
const { archiveCard } = await import('@/actions/archiveCard');
const { deleteCard } = await import('@/actions/deleteCard');
const { updateCardField } = await import('@/actions/updateCardField');
const { createComment } = await import('@/actions/createComment');
const { updateComment } = await import('@/actions/updateComment');
const { createSubtask } = await import('@/actions/createSubtask');
const { updateSubtaskField } = await import('@/actions/updateSubtaskField');
const { deleteSubtask } = await import('@/actions/deleteSubtask');
const { createColumn } = await import('@/actions/createColumn');
const { createLabel } = await import('@/actions/createLabel');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedBoard(access: 'EDIT' | 'COMMENT' | 'VIEW') {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
    ownerId: 'user-owner',
    role: 'MEMBER',
    access,
  });
  const todo = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const doing = await db.column.create({
    data: { title: 'Doing', order: 2, projectId: project.id },
  });
  const card = await db.card.create({
    data: { title: 'Write tests', order: 1, columnId: todo.id, code: 'SB-1' },
  });
  const subtask = await db.subtask.create({
    data: { text: 'First step', done: false, order: 1, cardId: card.id },
  });
  return { project, todo, doing, card, subtask };
}

describe('board access', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('lets EDIT create a card', async () => {
    const { todo } = await seedBoard('EDIT');
    const result = await createCard({ columnId: todo.id, title: 'Second' });
    expect(result).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ title: 'Second' }) }),
    );
  });

  it('rejects COMMENT on card and label writes', async () => {
    const { project, todo, doing, card, subtask } = await seedBoard('COMMENT');

    expect(await createCard({ columnId: todo.id, title: 'Nope' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await moveCard({ cardId: card.id, sourceColumnId: todo.id, targetColumnId: doing.id }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await archiveCard({ cardId: card.id })).toEqual({ error: 'Unauthorized' });
    expect(await deleteCard({ cardId: card.id })).toEqual({ error: 'Unauthorized' });
    expect(await updateCardField({ cardId: card.id, field: 'title', value: 'Renamed' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await createSubtask({ cardId: card.id, text: 'New step' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await updateSubtaskField({ subtaskId: subtask.id, field: 'text', value: 'Renamed' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await deleteSubtask({ subtaskId: subtask.id })).toEqual({ error: 'Unauthorized' });
    expect(await createColumn({ projectId: project.id, title: 'Blocked' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await createLabel({ projectId: project.id })).toEqual({ error: 'Unauthorized' });
  });

  it('lets COMMENT comment, edit their own comment, and check a subtask', async () => {
    const { card, subtask } = await seedBoard('COMMENT');

    const created = await createComment({ cardId: card.id, body: 'Looks good' });
    expect(created).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ body: 'Looks good' }) }),
    );
    const commentId = 'data' in created ? created.data.id : '';
    expect(await updateComment({ commentId, body: 'Looks better' })).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ body: 'Looks better' }) }),
    );
    expect(await updateSubtaskField({ subtaskId: subtask.id, field: 'done', value: true })).toEqual(
      {
        data: { value: true },
      },
    );
  });

  it('rejects VIEW on comments and subtask checks', async () => {
    const { card, subtask, todo } = await seedBoard('VIEW');
    const comment = await db.comment.create({
      data: { body: 'Mine', cardId: card.id, authorId: sessionUser.id },
    });

    expect(await createComment({ cardId: card.id, body: 'Hello' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await updateComment({ commentId: comment.id, body: 'Still mine' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await updateSubtaskField({ subtaskId: subtask.id, field: 'done', value: true })).toEqual(
      {
        error: 'Unauthorized',
      },
    );
    expect(await createCard({ columnId: todo.id, title: 'Nope' })).toEqual({
      error: 'Unauthorized',
    });
  });
});
