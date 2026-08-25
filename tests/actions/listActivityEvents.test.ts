// tests/actions/listActivityEvents.test.ts
//
// Tests for the listActivityEvents server action.
//
// Tested:
// - A VIEW member can read the project log
// - COMMENT and EDIT members can also read
// - A non-member is unauthorized
// - Rejects an empty or oversized project id without a lookup
// - Rejects the call when there is no session
// - Returns a page of events and a cursor for the rest
//
// What is covered:
// - Happy path, membership, unauthorized, invalid id, pagination
//
// Run with: pnpm test:run tests/actions/listActivityEvents.test.ts
//
// SEE: src/actions/listActivityEvents.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ACTIVITY_PAGE_SIZE } from '@/lib/activity';
import { MAX_ID_LENGTH } from '@/lib/validation/id';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
const getSession = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

const { listActivityEvents } = await import('@/actions/listActivityEvents');

const sessionUser = {
  id: 'user-ada',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  username: 'ada',
};

const createdPayload = {
  actorName: 'Ada Lovelace',
  actorUsername: 'ada',
  cardId: 'card-1',
  cardTitle: 'Write tests',
  columnId: 'col-todo',
  columnTitle: 'To do',
};

describe('listActivityEvents', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('lets a VIEW member read the project log', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      access: 'VIEW',
    });
    await db.activityEvent.create({
      data: {
        type: 'CARD_CREATED',
        projectId: project.id,
        actorId: sessionUser.id,
        payload: createdPayload,
      },
    });

    const result = await listActivityEvents({ projectId: project.id });

    expect(result).toEqual({
      data: {
        nextCursor: null,
        items: [
          expect.objectContaining({
            type: 'CARD_CREATED',
            valid: true,
            payload: expect.objectContaining({ cardTitle: 'Write tests' }),
          }),
        ],
      },
    });
  });

  it('lets COMMENT and EDIT members read', async () => {
    const commentProject = await seedAccessibleProject(db, {
      title: 'Comment board',
      userId: sessionUser.id,
      access: 'COMMENT',
    });
    const editProject = await seedAccessibleProject(db, {
      title: 'Edit board',
      userId: sessionUser.id,
      access: 'EDIT',
    });

    expect(await listActivityEvents({ projectId: commentProject.id })).toEqual({
      data: { items: [], nextCursor: null },
    });
    expect(await listActivityEvents({ projectId: editProject.id })).toEqual({
      data: { items: [], nextCursor: null },
    });
  });

  it('rejects a non-member', async () => {
    const project = await db.project.create({
      data: { title: 'Secret', ownerId: 'user-other' },
    });

    const result = await listActivityEvents({ projectId: project.id });

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('rejects an invalid project id without a lookup', async () => {
    db.project.findFirst.mockClear();

    expect(await listActivityEvents({ projectId: '' })).toEqual({ error: 'Unauthorized' });
    expect(await listActivityEvents({ projectId: '   ' })).toEqual({ error: 'Unauthorized' });
    expect(await listActivityEvents({ projectId: 'a'.repeat(MAX_ID_LENGTH + 1) })).toEqual({
      error: 'Unauthorized',
    });
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await listActivityEvents({ projectId: 'project-1' });

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('returns a page of events and a cursor for the rest', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const start = new Date('2026-08-25T12:00:00.000Z');
    for (let index = 0; index < ACTIVITY_PAGE_SIZE + 1; index += 1) {
      await db.activityEvent.create({
        data: {
          id: `event-${String(index).padStart(3, '0')}`,
          type: 'CARD_CREATED',
          projectId: project.id,
          actorId: sessionUser.id,
          createdAt: new Date(start.getTime() + index),
          payload: createdPayload,
        },
      });
    }

    const first = await listActivityEvents({ projectId: project.id });
    if ('error' in first) throw new Error('expected data');
    expect(first.data.items).toHaveLength(ACTIVITY_PAGE_SIZE);
    expect(first.data.nextCursor).not.toBeNull();

    const second = await listActivityEvents({
      projectId: project.id,
      cursor: first.data.nextCursor ?? undefined,
    });
    if ('error' in second) throw new Error('expected data');
    expect(second.data.items).toHaveLength(1);
    expect(second.data.nextCursor).toBeNull();
  });
});
