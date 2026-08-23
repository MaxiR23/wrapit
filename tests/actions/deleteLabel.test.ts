// tests/actions/deleteLabel.test.ts
//
// Tests for the deleteLabel server action.
//
// Tested:
// - Deletes a label and reassigns its cards to the first remaining label
// - Reassigns to the new first row when the first label is deleted
// - Rejects deleting the last remaining label and rolls the delete back
// - Serializes overlapping deletes of the last two labels so one remains
// - Concurrent deletes cannot leave a card pointing at a deleted label
// - Rejects a label on a project the user is not a member of
// - Rejects an invalid id before touching Prisma
// - Ignores a forged userId
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, reassignment, last-label rollback, concurrent last-two
//   deletes, orphan-safety, membership, validation-before-lookup, unauthorized
//
// Run with: pnpm test:run tests/actions/deleteLabel.test.ts
//
// SEE: src/actions/deleteLabel.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
const getSession = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next/cache', () => ({ revalidatePath }));

const { deleteLabel } = await import('@/actions/deleteLabel');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

async function seedProjectWithLabels() {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
  });
  await db.label.create({
    data: { id: 'l0', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
  });
  await db.label.create({
    data: { id: 'l1', projectId: project.id, name: 'Content', tone: 'green', order: 1 },
  });
  await db.label.create({
    data: { id: 'l2', projectId: project.id, name: 'Bug', tone: 'red', order: 2 },
  });
  return project;
}

describe('deleteLabel', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('deletes a label and reassigns its cards to the first remaining label', async () => {
    const project = await seedProjectWithLabels();
    const column = await db.column.create({
      data: { title: 'To do', order: 0, projectId: project.id },
    });
    await db.card.create({
      data: { id: 'card-bug', title: 'Fix', columnId: column.id, order: 1, labelId: 'l2' },
    });
    await db.card.create({
      data: { id: 'card-design', title: 'Draw', columnId: column.id, order: 2, labelId: 'l0' },
    });

    const result = await deleteLabel({ labelId: 'l2' });

    expect(result).toEqual({ data: { id: 'l2', replacementId: 'l0' } });
    expect(db.label.rows.map((row) => row.id)).toEqual(['l0', 'l1']);
    expect(db.card.rows.find((row) => row.id === 'card-bug')?.labelId).toBe('l0');
    expect(db.card.rows.find((row) => row.id === 'card-design')?.labelId).toBe('l0');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('reassigns cards to the new first row when the first label is deleted', async () => {
    const project = await seedProjectWithLabels();
    const column = await db.column.create({
      data: { title: 'To do', order: 0, projectId: project.id },
    });
    await db.card.create({
      data: { id: 'card-design', title: 'Draw', columnId: column.id, order: 1, labelId: 'l0' },
    });

    const result = await deleteLabel({ labelId: 'l0' });

    expect(result).toEqual({ data: { id: 'l0', replacementId: 'l1' } });
    expect(db.label.rows.map((row) => row.id)).toEqual(['l1', 'l2']);
    expect(db.card.rows[0]?.labelId).toBe('l1');
  });

  it('rejects deleting the last remaining label and rolls the delete and reassignment back', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.label.create({
      data: { id: 'l0', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 0, projectId: project.id },
    });
    await db.card.create({
      data: { id: 'card-1', title: 'Draw', columnId: column.id, order: 1, labelId: 'l0' },
    });

    const result = await deleteLabel({ labelId: 'l0' });

    expect(result).toEqual({ error: 'Cannot delete the last label' });
    expect(db.label.rows).toHaveLength(1);
    expect(db.label.rows[0]?.id).toBe('l0');
    expect(db.card.rows[0]?.labelId).toBe('l0');
  });

  it('serializes overlapping deletes of the last two labels so one remains', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.label.create({
      data: { id: 'l0', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });
    await db.label.create({
      data: { id: 'l1', projectId: project.id, name: 'Content', tone: 'green', order: 1 },
    });

    const results = await Promise.all([
      deleteLabel({ labelId: 'l0' }),
      deleteLabel({ labelId: 'l1' }),
    ]);

    const succeeded = results.filter((result) => 'data' in result);
    const failed = results.filter((result) => 'error' in result);
    expect(succeeded).toHaveLength(1);
    expect(failed).toEqual([{ error: 'Cannot delete the last label' }]);
    expect(db.label.rows).toHaveLength(1);
  });

  it('does not leave a card pointing at a deleted label after overlapping deletes', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.label.create({
      data: { id: 'l0', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });
    await db.label.create({
      data: { id: 'l1', projectId: project.id, name: 'Content', tone: 'green', order: 1 },
    });
    await db.label.create({
      data: { id: 'l2', projectId: project.id, name: 'Bug', tone: 'red', order: 2 },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 0, projectId: project.id },
    });
    await db.card.create({
      data: { id: 'card-a', title: 'A', columnId: column.id, order: 1, labelId: 'l0' },
    });
    await db.card.create({
      data: { id: 'card-b', title: 'B', columnId: column.id, order: 2, labelId: 'l1' },
    });

    const results = await Promise.all([
      deleteLabel({ labelId: 'l0' }),
      deleteLabel({ labelId: 'l1' }),
    ]);

    expect(results.filter((result) => 'data' in result)).toHaveLength(2);
    const liveIds = new Set(db.label.rows.map((row) => row.id));
    expect(liveIds.has('l2')).toBe(true);
    for (const card of db.card.rows) {
      expect(liveIds.has(card.labelId)).toBe(true);
    }
  });

  it('rejects a label on a project the user is not a member of', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: otherUserId },
    });
    await db.label.create({
      data: { id: 'other', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });

    const result = await deleteLabel({ labelId: 'other' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.label.rows).toHaveLength(1);
  });

  it('rejects an invalid id before touching Prisma', async () => {
    const result = await deleteLabel({ labelId: 'a'.repeat(MAX_ID_LENGTH + 1) });

    expect(result).toEqual({ fieldErrors: { labelId: expect.any(String) } });
    expect(db.label.findFirst).not.toHaveBeenCalled();
  });

  it('ignores a forged userId and always uses the session user', async () => {
    await seedProjectWithLabels();

    const result = await deleteLabel({ labelId: 'l2', userId: otherUserId } as {
      labelId: string;
    });

    expect(result).toEqual({ data: { id: 'l2', replacementId: 'l0' } });
    expect(db.label.rows.map((row) => row.id)).toEqual(['l0', 'l1']);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await deleteLabel({ labelId: 'l0' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.label.findFirst).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    db.label.findFirst.mockRejectedValueOnce(new Error('connection refused'));

    const result = await deleteLabel({ labelId: 'l0' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});
