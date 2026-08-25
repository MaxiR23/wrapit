// tests/lib/activity.test.ts
//
// Tests for activity event payloads, writes, and listing.
//
// Tested:
// - Parses a valid payload per event type
// - Rejects a payload missing required ids
// - Rejects unknown keys when writing
// - Writes a typed event through recordActivityEvent
// - Lists events newest first and returns a cursor after a full page
// - A corrupt payload is returned as an invalid row instead of throwing
//
// What is covered:
// - Happy path, invalid payload, strict write, pagination, corrupt read
//
// Run with: pnpm test:run tests/lib/activity.test.ts
//
// SEE: src/lib/activity.ts

import { describe, it, expect, beforeEach } from 'vitest';

import {
  ACTIVITY_PAGE_SIZE,
  activityEventFromRow,
  listActivityForProject,
  parseActivityPayload,
  recordActivityEvent,
} from '@/lib/activity';

import { createPrismaFake } from '../helpers/prismaFake';

const actor = { actorName: 'Ada Lovelace', actorUsername: 'ada' };

const validPayloads = {
  CARD_CREATED: {
    ...actor,
    cardId: 'card-1',
    cardTitle: 'Write tests',
    columnId: 'col-todo',
    columnTitle: 'To do',
  },
  CARD_MOVED: {
    ...actor,
    cardId: 'card-1',
    cardTitle: 'Write tests',
    fromColumnId: 'col-todo',
    fromColumnTitle: 'To do',
    toColumnId: 'col-doing',
    toColumnTitle: 'In progress',
  },
  CARD_ARCHIVED: { ...actor, cardId: 'card-1', cardTitle: 'Write tests' },
  CARD_DELETED: { ...actor, cardId: 'card-1', cardTitle: 'Write tests' },
  ASSIGNEES_CHANGED: {
    ...actor,
    cardId: 'card-1',
    cardTitle: 'Write tests',
    assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
  },
  LABEL_CHANGED: {
    ...actor,
    cardId: 'card-1',
    cardTitle: 'Write tests',
    labelId: 'label-1',
    labelName: 'Design',
  },
  DUE_DATE_CHANGED: {
    ...actor,
    cardId: 'card-1',
    cardTitle: 'Write tests',
    dueDate: '2026-08-25',
  },
  COMMENT_ADDED: {
    ...actor,
    cardId: 'card-1',
    cardTitle: 'Write tests',
    commentId: 'comment-1',
    body: 'Looks good',
  },
  MEMBER_ADDED: {
    ...actor,
    memberId: 'user-ada',
    memberName: 'Ada Lovelace',
    memberUsername: 'ada',
    inviterId: 'user-grace',
    inviterName: 'Grace Hopper',
    inviterUsername: 'grace',
  },
  MEMBER_REMOVED: {
    ...actor,
    memberId: 'user-ada',
    memberName: 'Ada Lovelace',
    memberUsername: 'ada',
  },
} as const;

describe('parseActivityPayload', () => {
  it('parses a valid payload for each event type', () => {
    for (const [type, payload] of Object.entries(validPayloads)) {
      const result = parseActivityPayload(type as keyof typeof validPayloads, payload);
      expect(result.success).toBe(true);
    }
  });

  it('rejects a payload missing a required id', () => {
    const result = parseActivityPayload('CARD_CREATED', {
      ...validPayloads.CARD_CREATED,
      cardId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys when writing strictly', () => {
    const result = parseActivityPayload(
      'CARD_CREATED',
      { ...validPayloads.CARD_CREATED, extra: 'nope' },
      { strict: true },
    );
    expect(result.success).toBe(false);
  });
});

describe('recordActivityEvent', () => {
  const db = createPrismaFake();

  beforeEach(() => {
    db.reset();
  });

  it('writes a typed event after a successful parse', async () => {
    await recordActivityEvent(db, {
      projectId: 'project-1',
      actorId: 'user-ada',
      type: 'CARD_CREATED',
      payload: validPayloads.CARD_CREATED,
    });

    expect(db.activityEvent.rows).toHaveLength(1);
    expect(db.activityEvent.rows[0]).toEqual(
      expect.objectContaining({
        type: 'CARD_CREATED',
        projectId: 'project-1',
        actorId: 'user-ada',
        payload: validPayloads.CARD_CREATED,
      }),
    );
  });

  it('throws and writes nothing when the payload is invalid', async () => {
    await expect(
      recordActivityEvent(db, {
        projectId: 'project-1',
        actorId: 'user-ada',
        type: 'CARD_CREATED',
        payload: { ...validPayloads.CARD_CREATED, cardId: '' },
      }),
    ).rejects.toThrow();
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});

describe('listActivityForProject', () => {
  const db = createPrismaFake();

  beforeEach(() => {
    db.reset();
  });

  it('returns events newest first and a cursor after a full page', async () => {
    const created = new Date('2026-08-25T12:00:00.000Z');
    for (let index = 0; index < ACTIVITY_PAGE_SIZE + 2; index += 1) {
      await db.activityEvent.create({
        data: {
          id: `event-${String(index).padStart(3, '0')}`,
          type: 'CARD_CREATED',
          projectId: 'project-1',
          actorId: 'user-ada',
          createdAt: new Date(created.getTime() + index),
          payload: validPayloads.CARD_CREATED,
        },
      });
    }

    const first = await listActivityForProject(db, 'project-1');
    expect(first.items).toHaveLength(ACTIVITY_PAGE_SIZE);
    expect(first.items[0]?.id).toBe(`event-${String(ACTIVITY_PAGE_SIZE + 1).padStart(3, '0')}`);
    expect(first.nextCursor).toEqual({
      createdAt: first.items[ACTIVITY_PAGE_SIZE - 1]?.createdAt,
      id: first.items[ACTIVITY_PAGE_SIZE - 1]?.id,
    });

    const second = await listActivityForProject(db, 'project-1', first.nextCursor);
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
  });

  it('returns an invalid row instead of throwing on a corrupt payload', () => {
    const item = activityEventFromRow({
      id: 'event-bad',
      type: 'CARD_CREATED',
      actorId: 'user-ada',
      createdAt: new Date('2026-08-25T12:00:00.000Z'),
      payload: { actorName: 'Ada Lovelace' },
    });
    expect(item.valid).toBe(false);
    expect(item.payload.actorName).toBe('Ada Lovelace');
  });
});
