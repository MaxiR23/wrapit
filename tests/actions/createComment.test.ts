// tests/actions/createComment.test.ts
//
// Tests for the createComment server action.
//
// Tested:
// - Creates a comment with the session user as author, never from the client
// - Rejects an empty body with a clear field error
// - Rejects an empty, oversized, or non-string card id without a lookup
// - Rejects a card the user does not own
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, author from session, invalid input, ownership, unauthorized, unexpected Prisma failure, invalid id
//
// Run with: pnpm test:run tests/actions/createComment.test.ts
//
// SEE: src/actions/createComment.ts

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

const { createComment } = await import('@/actions/createComment');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedOwnedCard() {
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
  return { project, column, card };
}

describe('createComment', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a comment with the session user as author', async () => {
    const { project, card } = await seedOwnedCard();
    await db.user.create({
      data: { id: sessionUser.id, name: sessionUser.name, username: sessionUser.username },
    });

    const result = await createComment({
      cardId: card.id,
      body: 'Looks good',
      authorId: 'user-forged',
    } as { cardId: string; body: string });

    expect(result).toEqual({
      data: expect.objectContaining({
        body: 'Looks good',
        cardId: card.id,
        createdAt: expect.any(Date),
        author: { id: sessionUser.id, name: 'Ada', username: 'ada' },
      }),
    });
    expect(db.comment.rows).toHaveLength(1);
    expect(db.comment.rows[0]?.authorId).toBe(sessionUser.id);
    expect(db.comment.rows[0]?.authorId).not.toBe('user-forged');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects an empty body with a clear field error', async () => {
    const { card } = await seedOwnedCard();

    const result = await createComment({ cardId: card.id, body: '' });

    expect(result).toEqual({ fieldErrors: { body: 'Comment is required' } });
    expect(db.comment.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid card id without a lookup', async () => {
    db.card.findFirst.mockClear();

    expect(await createComment({ cardId: '', body: 'Looks good' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await createComment({ cardId: '   ', body: 'Looks good' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await createComment({ cardId: 'a'.repeat(MAX_ID_LENGTH + 1), body: 'Looks good' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await createComment({ cardId: 1 as unknown as string, body: 'Looks good' })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.comment.create).not.toHaveBeenCalled();
    expect(db.comment.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects creating on a card the user does not own', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });

    const result = await createComment({ cardId: card.id, body: 'Hijacked' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.comment.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { card } = await seedOwnedCard();

    const result = await createComment({ cardId: card.id, body: 'Looks good' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.comment.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { card } = await seedOwnedCard();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.comment.create.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await createComment({ cardId: card.id, body: 'Looks good' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(db.comment.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
