// tests/actions/updateCardAssignees.test.ts
//
// Tests for the updateCardAssignees server action.
//
// Tested:
// - Replaces assignees with member ids and returns them
// - Allows an empty list that clears assignees
// - Rejects a non-member assignee without writing
// - Rejects an empty, oversized, or non-string card id without a lookup
// - Rejects the call when there is no session or the user is not a member
//
// What is covered:
// - Happy path, empty list, membership, unauthorized, invalid id
//
// Run with: pnpm test:run tests/actions/updateCardAssignees.test.ts
//
// SEE: src/actions/updateCardAssignees.ts

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

const { updateCardAssignees } = await import('@/actions/updateCardAssignees');

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

describe('updateCardAssignees', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('replaces assignees with member ids and returns them', async () => {
    const { project, card } = await seedOwnedCard();
    await db.user.create({
      data: { id: sessionUser.id, name: 'Ada', username: 'ada' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER' },
    });
    await db.cardAssignee.create({
      data: { cardId: card.id, userId: sessionUser.id },
    });

    const result = await updateCardAssignees({
      cardId: card.id,
      assigneeIds: ['user-max', sessionUser.id],
    });

    expect(result).toEqual({
      data: {
        assignees: [
          { id: 'user-max', name: 'Maxi', username: 'maxi' },
          { id: sessionUser.id, name: 'Ada', username: 'ada' },
        ],
      },
    });
    expect(db.cardAssignee.rows).toHaveLength(2);
    expect(db.cardAssignee.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardId: card.id, userId: 'user-max' }),
        expect.objectContaining({ cardId: card.id, userId: sessionUser.id }),
      ]),
    );
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'ASSIGNEES_CHANGED',
        payload: expect.objectContaining({
          cardTitle: 'Write tests',
          assignees: [
            { id: 'user-max', name: 'Maxi', username: 'maxi' },
            { id: sessionUser.id, name: 'Ada', username: 'ada' },
          ],
        }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('allows an empty list that clears assignees', async () => {
    const { project, card } = await seedOwnedCard();
    await db.cardAssignee.create({
      data: { cardId: card.id, userId: sessionUser.id },
    });

    const result = await updateCardAssignees({ cardId: card.id, assigneeIds: [] });

    expect(result).toEqual({ data: { assignees: [] } });
    expect(db.cardAssignee.rows).toHaveLength(0);
    expect(db.activityEvent.rows[0]?.payload).toEqual(expect.objectContaining({ assignees: [] }));
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects a non-member assignee without writing', async () => {
    const { card } = await seedOwnedCard();
    await db.cardAssignee.create({
      data: { cardId: card.id, userId: sessionUser.id },
    });

    const result = await updateCardAssignees({
      cardId: card.id,
      assigneeIds: ['user-stranger'],
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.cardAssignee.rows).toEqual([
      expect.objectContaining({ cardId: card.id, userId: sessionUser.id }),
    ]);
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid card id without a lookup', async () => {
    db.card.findFirst.mockClear();

    expect(await updateCardAssignees({ cardId: '', assigneeIds: [] })).toEqual({
      error: 'Unauthorized',
    });
    expect(await updateCardAssignees({ cardId: '   ', assigneeIds: [] })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await updateCardAssignees({
        cardId: 'a'.repeat(MAX_ID_LENGTH + 1),
        assigneeIds: [],
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await updateCardAssignees({ cardId: 1 as unknown as string, assigneeIds: [] })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.cardAssignee.deleteMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects updating a card the user does not own', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });
    await db.cardAssignee.create({
      data: { cardId: card.id, userId: 'user-other' },
    });

    const result = await updateCardAssignees({
      cardId: card.id,
      assigneeIds: [sessionUser.id],
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.cardAssignee.rows).toEqual([
      expect.objectContaining({ cardId: card.id, userId: 'user-other' }),
    ]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { card } = await seedOwnedCard();

    const result = await updateCardAssignees({
      cardId: card.id,
      assigneeIds: [sessionUser.id],
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back the assignee replace when logging fails', async () => {
    const { card } = await seedOwnedCard();
    await db.user.create({
      data: { id: sessionUser.id, name: 'Ada', username: 'ada' },
    });
    await db.cardAssignee.create({
      data: { cardId: card.id, userId: sessionUser.id },
    });
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await updateCardAssignees({
      cardId: card.id,
      assigneeIds: [],
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.cardAssignee.rows).toEqual([
      expect.objectContaining({ cardId: card.id, userId: sessionUser.id }),
    ]);
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
