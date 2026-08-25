// tests/actions/listMyActivityEvents.test.ts
//
// Tests for the listMyActivityEvents server action.
//
// Tested:
// - Returns the session user's events across projects they belong to
// - Hides another actor's events and events on a project they left
// - Rejects an invalid cursor without a lookup
// - Rejects the call when there is no session
// - Returns a page of events and a cursor for the rest
//
// What is covered:
// - Happy path, isolation, unauthorized, invalid cursor, pagination
//
// Run with: pnpm test:run tests/actions/listMyActivityEvents.test.ts
//
// SEE: src/actions/listMyActivityEvents.ts

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

const { listMyActivityEvents } = await import('@/actions/listMyActivityEvents');

const sessionUser = {
  id: 'user-ada',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  username: 'ada',
};

const createdPayload = {
  actorName: 'Ada Lovelace',
  actorUsername: 'ada',
  projectTitle: 'Sprint board',
};

describe('listMyActivityEvents', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('returns only the session users events on current memberships', async () => {
    const mine = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const left = await db.project.create({
      data: { title: 'Old board', ownerId: sessionUser.id },
    });
    await db.activityEvent.create({
      data: {
        id: 'evt-mine',
        type: 'PROJECT_CREATED',
        projectId: mine.id,
        actorId: sessionUser.id,
        payload: { ...createdPayload, projectTitle: 'Sprint board' },
      },
    });
    await db.activityEvent.create({
      data: {
        id: 'evt-other',
        type: 'PROJECT_CREATED',
        projectId: mine.id,
        actorId: 'user-grace',
        payload: {
          actorName: 'Grace Hopper',
          actorUsername: 'grace',
          projectTitle: 'Sprint board',
        },
      },
    });
    await db.activityEvent.create({
      data: {
        id: 'evt-left',
        type: 'PROJECT_CREATED',
        projectId: left.id,
        actorId: sessionUser.id,
        payload: { ...createdPayload, projectTitle: 'Old board' },
      },
    });

    const result = await listMyActivityEvents({});

    expect(result).toEqual({
      data: {
        nextCursor: null,
        items: [
          expect.objectContaining({
            id: 'evt-mine',
            projectId: mine.id,
            projectTitle: 'Sprint board',
          }),
        ],
      },
    });
  });

  it('rejects an invalid cursor without a lookup', async () => {
    db.membership.findMany.mockClear();

    expect(await listMyActivityEvents({ cursor: { createdAt: 'nope', id: 'event-1' } })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await listMyActivityEvents({ cursor: { createdAt: new Date().toISOString(), id: '' } }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await listMyActivityEvents({
        cursor: { createdAt: new Date().toISOString(), id: 'a'.repeat(MAX_ID_LENGTH + 1) },
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.membership.findMany).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await listMyActivityEvents({});

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.findMany).not.toHaveBeenCalled();
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
          type: 'PROJECT_CREATED',
          projectId: project.id,
          actorId: sessionUser.id,
          createdAt: new Date(start.getTime() + index),
          payload: createdPayload,
        },
      });
    }

    const first = await listMyActivityEvents({});
    if ('error' in first) throw new Error('expected data');
    expect(first.data.items).toHaveLength(ACTIVITY_PAGE_SIZE);
    expect(first.data.nextCursor).not.toBeNull();

    const second = await listMyActivityEvents({ cursor: first.data.nextCursor ?? undefined });
    if ('error' in second) throw new Error('expected data');
    expect(second.data.items).toHaveLength(1);
    expect(second.data.nextCursor).toBeNull();
  });
});
