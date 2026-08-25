// tests/actions/updateCardLabel.test.ts
//
// Tests for the updateCardLabel server action.
//
// Tested:
// - Sets labelId when the label belongs to the same project
// - Clears the label when labelId is null or omitted
// - Rejects a label from another project
// - Rejects an empty, oversized, or non-string id without a lookup
//
// What is covered:
// - Happy path, clear, membership, unauthorized, invalid id
//
// Run with: pnpm test:run tests/actions/updateCardLabel.test.ts
//
// SEE: src/actions/updateCardLabel.ts

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

const { updateCardLabel } = await import('@/actions/updateCardLabel');

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

describe('updateCardLabel', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('sets labelId when the label belongs to the same project', async () => {
    const { project, card } = await seedOwnedCard();
    const label = await db.label.create({
      data: { name: 'Design', tone: 'blue', order: 0, projectId: project.id },
    });

    const result = await updateCardLabel({ cardId: card.id, labelId: label.id });

    expect(result).toEqual({ data: { labelId: label.id } });
    expect(db.card.rows[0]?.labelId).toBe(label.id);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'LABEL_CHANGED',
        payload: expect.objectContaining({ labelId: label.id, labelName: 'Design' }),
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('clears the label when labelId is null or omitted', async () => {
    const { project, card } = await seedOwnedCard();
    const label = await db.label.create({
      data: { name: 'Design', tone: 'blue', order: 0, projectId: project.id },
    });
    await db.card.update({
      where: { id: card.id },
      data: { labelId: label.id },
    });

    const cleared = await updateCardLabel({ cardId: card.id, labelId: null });

    expect(cleared).toEqual({ data: { labelId: null } });
    expect(db.card.rows[0]?.labelId).toBeNull();

    await db.card.update({
      where: { id: card.id },
      data: { labelId: label.id },
    });

    const omitted = await updateCardLabel({ cardId: card.id });

    expect(omitted).toEqual({ data: { labelId: null } });
    expect(db.card.rows[0]?.labelId).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('keeps the snapshotted label name after a rename', async () => {
    const { project, card } = await seedOwnedCard();
    const label = await db.label.create({
      data: { name: 'Design', tone: 'blue', order: 0, projectId: project.id },
    });

    await updateCardLabel({ cardId: card.id, labelId: label.id });
    await db.label.update({ where: { id: label.id }, data: { name: 'Product' } });

    expect(db.activityEvent.rows[0]?.payload).toEqual(
      expect.objectContaining({ labelName: 'Design' }),
    );
  });

  it('rejects a label from another project', async () => {
    const { project, card } = await seedOwnedCard();
    const local = await db.label.create({
      data: { name: 'Design', tone: 'blue', order: 0, projectId: project.id },
    });
    await db.card.update({
      where: { id: card.id },
      data: { labelId: local.id },
    });
    const other = await seedAccessibleProject(db, {
      title: 'Other board',
      userId: 'user-other',
    });
    const foreign = await db.label.create({
      data: { name: 'Secret', tone: 'red', order: 0, projectId: other.id },
    });

    const result = await updateCardLabel({ cardId: card.id, labelId: foreign.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.labelId).toBe(local.id);
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid id without a lookup', async () => {
    db.card.findFirst.mockClear();
    db.label.count.mockClear();

    expect(await updateCardLabel({ cardId: '', labelId: 'label-1' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await updateCardLabel({ cardId: '   ', labelId: 'label-1' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await updateCardLabel({
        cardId: 'a'.repeat(MAX_ID_LENGTH + 1),
        labelId: 'label-1',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await updateCardLabel({ cardId: 1 as unknown as string, labelId: 'label-1' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await updateCardLabel({ cardId: 'card-1', labelId: '' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await updateCardLabel({
        cardId: 'card-1',
        labelId: 'a'.repeat(MAX_ID_LENGTH + 1),
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.label.count).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back the label change when logging fails', async () => {
    const { project, card } = await seedOwnedCard();
    const label = await db.label.create({
      data: { name: 'Design', tone: 'blue', order: 0, projectId: project.id },
    });
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await updateCardLabel({ cardId: card.id, labelId: label.id });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.card.rows[0]?.labelId).toBeUndefined();
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
