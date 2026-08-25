// tests/actions/createCard.test.ts
//
// Tests for the createCard server action.
//
// Tested:
// - Creates a card on the owner's column with an appending order
// - Issues SB-1 then SB-2 from an atomic cardCounter increment
// - Stores the code from the title at create time so a rename does not rewrite it
// - Accepts an optional description
// - Rejects an empty title with a clear field error
// - Rejects creating on a column the user does not own
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
// - Rejects an empty, oversized, or non-string column id without a lookup
// - Persists an optional due date, label, and assignees in the same transaction
// - Assigns the creator when no assignees are picked
// - Rejects a non-member assignee or a label from another project
//
// What is covered:
// - Happy path, optional description, due date, label, assignees, creator fallback, invalid input, ownership, unauthorized, unexpected Prisma failure, invalid id
//
// Run with: pnpm test:run tests/actions/createCard.test.ts
//
// SEE: src/actions/createCard.ts

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

const { createCard } = await import('@/actions/createCard');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };

async function seedOwnedColumn() {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  return { project, column };
}

describe('createCard', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates a card on the owner column with an appending order', async () => {
    const { project, column } = await seedOwnedColumn();
    await db.card.create({
      data: { title: 'First', order: 1, columnId: column.id },
    });

    const result = await createCard({ columnId: column.id, title: 'Second' });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Second',
        columnId: column.id,
        order: 2,
        description: null,
        code: 'SB-1',
      }),
    });
    expect(db.card.rows).toHaveLength(2);
    expect(db.project.rows[0]?.cardCounter).toBe(1);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'CARD_CREATED',
        projectId: project.id,
        actorId: sessionUser.id,
        payload: expect.objectContaining({
          actorName: 'Ada',
          cardTitle: 'Second',
          columnTitle: 'To do',
        }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('assigns order 1 when the column has no cards yet', async () => {
    const { column } = await seedOwnedColumn();

    const result = await createCard({ columnId: column.id, title: 'First' });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'First',
        order: 1,
        code: 'SB-1',
      }),
    });
    expect(db.project.rows[0]?.cardCounter).toBe(1);
  });

  it('increments the project counter so a second card gets the next code', async () => {
    const { column } = await seedOwnedColumn();

    await createCard({ columnId: column.id, title: 'First' });
    const result = await createCard({ columnId: column.id, title: 'Second' });

    expect(result).toEqual({
      data: expect.objectContaining({ title: 'Second', code: 'SB-2', order: 2 }),
    });
    expect(db.project.rows[0]?.cardCounter).toBe(2);
  });

  it('stores the code from the title at create time so a later rename does not rewrite it', async () => {
    const { project, column } = await seedOwnedColumn();

    await createCard({ columnId: column.id, title: 'First' });
    await db.project.update({
      where: { id: project.id },
      data: { title: 'Website redesign' },
    });
    const result = await createCard({ columnId: column.id, title: 'Second' });

    expect(db.card.rows[0]).toEqual(expect.objectContaining({ title: 'First', code: 'SB-1' }));
    expect(result).toEqual({
      data: expect.objectContaining({ title: 'Second', code: 'WR-2' }),
    });
  });

  it('accepts an optional description', async () => {
    const { column } = await seedOwnedColumn();

    const result = await createCard({
      columnId: column.id,
      title: 'Write tests',
      description: 'Cover ownership',
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Write tests',
        description: 'Cover ownership',
      }),
    });
  });

  it('rejects an empty title with a clear field error', async () => {
    const { column } = await seedOwnedColumn();

    const result = await createCard({ columnId: column.id, title: '' });

    expect(result).toEqual({ fieldErrors: { title: 'Title is required' } });
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects creating on a column the user does not own', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });

    const result = await createCard({ columnId: column.id, title: 'Stolen' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { column } = await seedOwnedColumn();

    const result = await createCard({ columnId: column.id, title: 'Write tests' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { column } = await seedOwnedColumn();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.create.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await createCard({ columnId: column.id, title: 'Write tests' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid column id without a lookup', async () => {
    db.column.findFirst.mockClear();

    expect(await createCard({ columnId: '', title: 'Write tests' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await createCard({ columnId: '   ', title: 'Write tests' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await createCard({ columnId: 'a'.repeat(MAX_ID_LENGTH + 1), title: 'Write tests' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await createCard({ columnId: 1 as unknown as string, title: 'Write tests' })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.column.findFirst).not.toHaveBeenCalled();
    expect(db.card.create).not.toHaveBeenCalled();
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('persists a due date, label, and assignees in the same transaction', async () => {
    const { project, column } = await seedOwnedColumn();
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER' },
    });
    const label = await db.label.create({
      data: { name: 'Design', tone: 'blue', order: 0, projectId: project.id },
    });

    const result = await createCard({
      columnId: column.id,
      title: 'Ship the modal',
      labelId: label.id,
      dueDate: '2026-08-25',
      assigneeIds: ['user-max', sessionUser.id],
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        title: 'Ship the modal',
        code: 'SB-1',
        labelId: label.id,
        dueDate: new Date(Date.UTC(2026, 7, 25)),
        assignees: [
          { id: 'user-max', name: 'Maxi', username: 'maxi' },
          { id: sessionUser.id, name: 'Ada', username: '' },
        ],
      }),
    });
    expect(db.cardAssignee.rows).toHaveLength(2);
    expect(db.project.rows[0]?.cardCounter).toBe(1);
    expect(db.activityEvent.rows).toHaveLength(1);
    expect(db.activityEvent.rows[0]?.type).toBe('CARD_CREATED');
  });

  it('assigns the creator when no assignees are picked', async () => {
    const { column } = await seedOwnedColumn();

    const result = await createCard({ columnId: column.id, title: 'Solo' });

    expect(result).toEqual({
      data: expect.objectContaining({
        assignees: [{ id: sessionUser.id, name: 'Ada', username: '' }],
      }),
    });
    expect(db.cardAssignee.rows).toEqual([
      expect.objectContaining({ userId: sessionUser.id, cardId: expect.any(String) }),
    ]);
  });

  it('rejects a non-member assignee without writing a card', async () => {
    const { column } = await seedOwnedColumn();

    const result = await createCard({
      columnId: column.id,
      title: 'Stolen',
      assigneeIds: ['user-stranger'],
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(0);
    expect(db.cardAssignee.rows).toHaveLength(0);
    expect(db.project.rows[0]?.cardCounter ?? 0).toBe(0);
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a label from another project without writing a card', async () => {
    const { column } = await seedOwnedColumn();
    const other = await seedAccessibleProject(db, {
      title: 'Other board',
      userId: 'user-other',
    });
    const foreignLabel = await db.label.create({
      data: { name: 'Secret', tone: 'red', order: 0, projectId: other.id },
    });

    const result = await createCard({
      columnId: column.id,
      title: 'Leak',
      labelId: foreignLabel.id,
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid due date without a lookup', async () => {
    db.column.findFirst.mockClear();

    const result = await createCard({
      columnId: 'column-1',
      title: 'Write tests',
      dueDate: '25 ago',
    });

    expect(result).toEqual({ fieldErrors: { dueDate: 'Enter a valid date' } });
    expect(db.column.findFirst).not.toHaveBeenCalled();
    expect(db.card.rows).toHaveLength(0);
  });

  it('rejects an invalid assignee id without a lookup', async () => {
    db.column.findFirst.mockClear();

    expect(
      await createCard({ columnId: 'column-1', title: 'Write tests', assigneeIds: [''] }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.column.findFirst).not.toHaveBeenCalled();
  });

  it('rolls back the card when logging fails', async () => {
    const { column } = await seedOwnedColumn();
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await createCard({ columnId: column.id, title: 'Write tests' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.card.rows).toHaveLength(0);
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
