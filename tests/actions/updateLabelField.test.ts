// tests/actions/updateLabelField.test.ts
//
// Tests for the updateLabelField server action.
//
// Tested:
// - Updates name and tone on a label the member can access
// - Stores the trimmed value
// - Rejects an empty name and an unknown tone
// - Rejects a label on a project the user is not a member of
// - Rejects an invalid id before touching Prisma
// - Ignores a forged userId
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, membership, validation-before-lookup, unauthorized, unexpected failure
//
// Run with: pnpm test:run tests/actions/updateLabelField.test.ts
//
// SEE: src/actions/updateLabelField.ts

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

const { updateLabelField } = await import('@/actions/updateLabelField');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

describe('updateLabelField', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('updates name and tone on a label the member can access', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.label.create({
      data: { id: 'label-a', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });

    expect(
      await updateLabelField({ labelId: 'label-a', field: 'name', value: '  Visual  ' }),
    ).toEqual({ data: { value: 'Visual' } });
    expect(db.label.rows[0]?.name).toBe('Visual');

    expect(await updateLabelField({ labelId: 'label-a', field: 'tone', value: 'pink' })).toEqual({
      data: { value: 'pink' },
    });
    expect(db.label.rows[0]?.tone).toBe('pink');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects an empty name and an unknown tone without writing', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.label.create({
      data: { id: 'label-a', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });

    expect(await updateLabelField({ labelId: 'label-a', field: 'name', value: '   ' })).toEqual({
      fieldErrors: { value: expect.any(String) },
    });
    expect(db.label.rows[0]?.name).toBe('Design');
    expect(db.label.findFirst).not.toHaveBeenCalled();

    expect(await updateLabelField({ labelId: 'label-a', field: 'tone', value: 'secret' })).toEqual({
      fieldErrors: { value: expect.any(String) },
    });
    expect(db.label.rows[0]?.tone).toBe('blue');
    expect(db.label.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a label on a project the user is not a member of', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: otherUserId },
    });
    await db.label.create({
      data: { id: 'label-other', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });

    const result = await updateLabelField({
      labelId: 'label-other',
      field: 'name',
      value: 'Nope',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.label.rows[0]?.name).toBe('Design');
  });

  it('rejects an invalid id before touching Prisma', async () => {
    const result = await updateLabelField({
      labelId: 'a'.repeat(MAX_ID_LENGTH + 1),
      field: 'name',
      value: 'Design',
    });

    expect(result).toEqual({ fieldErrors: { labelId: expect.any(String) } });
    expect(db.label.findFirst).not.toHaveBeenCalled();
    expect(db.label.updateMany).not.toHaveBeenCalled();
  });

  it('ignores a forged userId and always uses the session user', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.label.create({
      data: { id: 'label-a', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });
    const other = await db.project.create({
      data: { title: 'Other board', ownerId: otherUserId },
    });
    await db.label.create({
      data: { id: 'label-other', projectId: other.id, name: 'Design', tone: 'blue', order: 0 },
    });

    const result = await updateLabelField({
      labelId: 'label-a',
      field: 'name',
      value: 'Visual',
      userId: otherUserId,
    } as { labelId: string; field: string; value: string });

    expect(result).toEqual({ data: { value: 'Visual' } });
    expect(db.label.rows[0]?.name).toBe('Visual');
    expect(db.label.rows[1]?.name).toBe('Design');
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await updateLabelField({
      labelId: 'label-a',
      field: 'name',
      value: 'Design',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.label.findFirst).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    db.label.findFirst.mockRejectedValueOnce(new Error('connection refused'));

    const result = await updateLabelField({
      labelId: 'label-a',
      field: 'name',
      value: 'Design',
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});
