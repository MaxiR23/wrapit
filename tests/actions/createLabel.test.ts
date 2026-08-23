// tests/actions/createLabel.test.ts
//
// Tests for the createLabel server action.
//
// Tested:
// - Creates Label N with the next tone and max(order)+1
// - Seeds defaults first when the project has no labels
// - Caps the list at 20 and does not write the 21st
// - Rejects a project the user is not a member of
// - Rejects an invalid id before touching Prisma
// - Ignores a forged userId
// - Rejects the call when there is no session
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, seed-then-append, cap, membership, validation-before-lookup,
//   unauthorized, unexpected failure
//
// Run with: pnpm test:run tests/actions/createLabel.test.ts
//
// SEE: src/actions/createLabel.ts

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

const { createLabel } = await import('@/actions/createLabel');
const { MAX_PROJECT_LABELS, MAX_PROJECT_LABELS_MESSAGE } = await import('@/lib/labels');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada' };
const otherUserId = 'user-other';

describe('createLabel', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('creates Label N with the next tone and max(order)+1', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.label.create({
      data: { id: 'l0', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });
    await db.label.create({
      data: { id: 'l2', projectId: project.id, name: 'Infra', tone: 'amber', order: 2 },
    });

    const result = await createLabel({ projectId: project.id });

    expect(result).toEqual({
      data: {
        id: expect.any(String),
        name: 'Label 3',
        tone: 'amber',
        order: 3,
      },
    });
    expect(db.label.rows).toHaveLength(3);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('seeds six defaults then appends Label 7 when the project has none', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });

    const result = await createLabel({ projectId: project.id });

    expect(result).toEqual({
      data: {
        id: expect.any(String),
        name: 'Label 7',
        tone: 'pink',
        order: 6,
      },
    });
    expect(db.label.rows).toHaveLength(7);
  });

  it('caps the list at 20 and does not write the 21st', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    for (let order = 0; order < MAX_PROJECT_LABELS; order += 1) {
      await db.label.create({
        data: {
          id: `l${order}`,
          projectId: project.id,
          name: `L${order}`,
          tone: 'blue',
          order,
        },
      });
    }

    const result = await createLabel({ projectId: project.id });

    expect(result).toEqual({ error: MAX_PROJECT_LABELS_MESSAGE });
    expect(db.label.rows).toHaveLength(MAX_PROJECT_LABELS);
  });

  it('rejects a project the user is not a member of', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: otherUserId },
    });

    const result = await createLabel({ projectId: project.id });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.label.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid id before touching Prisma', async () => {
    const result = await createLabel({ projectId: 'a'.repeat(MAX_ID_LENGTH + 1) });

    expect(result).toEqual({ fieldErrors: { projectId: expect.any(String) } });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('ignores a forged userId and always uses the session user', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.label.create({
      data: { id: 'l0', projectId: project.id, name: 'Design', tone: 'blue', order: 0 },
    });

    const result = await createLabel({
      projectId: project.id,
      userId: otherUserId,
    } as { projectId: string });

    expect(result).toEqual({
      data: expect.objectContaining({ name: 'Label 2', order: 1 }),
    });
    expect(db.label.rows).toHaveLength(2);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await createLabel({ projectId: 'project-1' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    db.$transaction.mockRejectedValueOnce(new Error('connection refused'));

    const result = await createLabel({ projectId: 'project-1' });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});
