// tests/actions/updateComment.test.ts
//
// Tests for the updateComment server action.
//
// Tested:
// - The author updates the body; createdAt is unchanged; editedAt is set
// - A no-op after trim writes nothing and leaves editedAt null
// - Empty or whitespace-only text is rejected
// - Non-authors including OWNER and ADMIN are rejected
// - VIEW access is rejected even for the author
// - An occupancy miss returns the conflict message and keeps the stored body
// - Editing does not write an activity event or a notification
// - Editing the older comment does not change createdAt order
//
// What is covered:
// - Happy path, no-op, validation, author-only, access, occupancy, ordering, no log
//
// Run with: pnpm test:run tests/actions/updateComment.test.ts
//
// SEE: src/actions/updateComment.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { COMMENT_CHANGED_ELSEWHERE_MESSAGE } from '@/lib/messages';
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

const { updateComment } = await import('@/actions/updateComment');
const { getProjectForUser } = await import('@/lib/projects');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

async function seedComment(options?: {
  userId?: string;
  access?: 'EDIT' | 'COMMENT' | 'VIEW';
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
  ownerId?: string;
  authorId?: string;
  body?: string;
  createdAt?: Date;
}) {
  const userId = options?.userId ?? sessionUser.id;
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId,
    ownerId: options?.ownerId ?? userId,
    role: options?.role ?? 'OWNER',
    access: options?.access ?? 'EDIT',
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const card = await db.card.create({
    data: { title: 'Write tests', order: 1, columnId: column.id },
  });
  const comment = await db.comment.create({
    data: {
      body: options?.body ?? 'Looks good',
      cardId: card.id,
      authorId: options?.authorId ?? userId,
      ...(options?.createdAt ? { createdAt: options.createdAt } : {}),
    },
  });
  return { project, column, card, comment };
}

describe('updateComment', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('lets the author update the body without rewriting createdAt', async () => {
    const { project, comment } = await seedComment({
      access: 'COMMENT',
      role: 'MEMBER',
      ownerId: 'user-owner',
    });
    const createdAt = comment.createdAt as Date;

    const result = await updateComment({ commentId: comment.id, body: 'Looks **better**' });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: comment.id,
        body: 'Looks **better**',
        createdAt,
        editedAt: expect.any(Date),
        author: { id: sessionUser.id, name: 'Ada', username: 'ada' },
      }),
    });
    expect(db.comment.rows[0]?.createdAt).toEqual(createdAt);
    expect(db.comment.rows[0]?.body).toBe('Looks **better**');
    expect(db.comment.rows[0]?.editedAt).toBeInstanceOf(Date);
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(db.notification.rows).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('writes nothing when the trimmed body is unchanged and leaves editedAt null', async () => {
    const { comment } = await seedComment({ body: 'Looks good' });

    const result = await updateComment({ commentId: comment.id, body: '  Looks good  ' });

    expect(result).toEqual({
      data: expect.objectContaining({
        body: 'Looks good',
        editedAt: null,
      }),
    });
    expect(db.comment.rows[0]?.editedAt).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('rejects empty or whitespace-only text', async () => {
    const { comment } = await seedComment();

    expect(await updateComment({ commentId: comment.id, body: '' })).toEqual({
      fieldErrors: { body: 'Comment is required' },
    });
    expect(await updateComment({ commentId: comment.id, body: '   ' })).toEqual({
      fieldErrors: { body: 'Comment is required' },
    });
    expect(db.comment.rows[0]?.body).toBe('Looks good');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid comment id without a lookup', async () => {
    db.comment.findFirst.mockClear();

    expect(await updateComment({ commentId: '', body: 'Looks good' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await updateComment({ commentId: '   ', body: 'Looks good' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await updateComment({ commentId: 'a'.repeat(MAX_ID_LENGTH + 1), body: 'Looks good' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await updateComment({ commentId: 1 as unknown as string, body: 'Looks good' })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.comment.findFirst).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a MEMBER who is not the author', async () => {
    const { comment } = await seedComment({
      userId: sessionUser.id,
      role: 'MEMBER',
      access: 'EDIT',
      ownerId: 'user-owner',
      authorId: 'user-grace',
    });

    const result = await updateComment({ commentId: comment.id, body: 'Hijacked' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.comment.rows[0]?.body).toBe('Looks good');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the project OWNER who is not the author', async () => {
    const { comment } = await seedComment({
      userId: sessionUser.id,
      role: 'OWNER',
      access: 'EDIT',
      authorId: 'user-grace',
    });

    const result = await updateComment({ commentId: comment.id, body: 'Owner rewrite' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.comment.rows[0]?.body).toBe('Looks good');
    expect(db.comment.rows[0]?.editedAt).toBeUndefined();
  });

  it('rejects an ADMIN who is not the author', async () => {
    const { comment } = await seedComment({
      userId: sessionUser.id,
      role: 'ADMIN',
      access: 'EDIT',
      ownerId: 'user-owner',
      authorId: 'user-grace',
    });

    const result = await updateComment({ commentId: comment.id, body: 'Admin rewrite' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.comment.rows[0]?.body).toBe('Looks good');
  });

  it('rejects VIEW even when the caller is the author', async () => {
    const { comment } = await seedComment({
      role: 'MEMBER',
      access: 'VIEW',
      ownerId: 'user-owner',
    });

    const result = await updateComment({ commentId: comment.id, body: 'Still mine' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.comment.rows[0]?.body).toBe('Looks good');
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { comment } = await seedComment();

    const result = await updateComment({ commentId: comment.id, body: 'Looks better' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns the conflict message when occupancy misses and keeps the stored body', async () => {
    const { comment } = await seedComment();
    db.comment.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await updateComment({ commentId: comment.id, body: 'Looks better' });

    expect(result).toEqual({ error: COMMENT_CHANGED_ELSEWHERE_MESSAGE });
    expect(result).not.toEqual({
      error: 'Something went wrong. Please try again.',
    });
    expect(db.comment.rows[0]?.body).toBe('Looks good');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { comment } = await seedComment();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.comment.updateMany.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await updateComment({ commentId: comment.id, body: 'Looks better' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('does not reorder comments when the older one is edited', async () => {
    const { project, card } = await seedComment({
      body: 'First note',
      createdAt: new Date('2026-08-01'),
    });
    await db.user.create({
      data: { id: sessionUser.id, name: sessionUser.name, username: sessionUser.username },
    });
    const older = db.comment.rows[0];
    await db.comment.create({
      data: {
        body: 'Second note',
        cardId: card.id,
        authorId: sessionUser.id,
        createdAt: new Date('2026-08-02'),
      },
    });

    const result = await updateComment({
      commentId: older?.id as string,
      body: 'First note edited',
    });

    expect(result).toEqual(expect.objectContaining({ data: expect.anything() }));
    expect(db.comment.rows.find((row) => row.id === older?.id)?.createdAt).toEqual(
      new Date('2026-08-01'),
    );

    const loaded = await getProjectForUser(project.id, sessionUser.id);
    expect(loaded?.columns[0]?.cards[0]?.comments.map((comment) => comment.body)).toEqual([
      'First note edited',
      'Second note',
    ]);
  });
});
