// tests/lib/activityDisplay.test.ts
//
// Tests for activity sentences, day grouping, and collapsing.
//
// Tested:
// - Builds an English sentence from each event type
// - Names the granted role on MEMBER_ADDED when the payload has one
// - Keeps a snapshotted column name after a rename
// - Formats a due date as an absolute calendar day, not Today
// - Reads a due moment in the viewer zone and names the zone it was set in
// - Keeps the sentence of an event written before due dates could carry a time
// - Collapses consecutive same-type edits on the same card
// - A collapsed move reads as the first from-column to the last to-column
// - Member events do not collapse
// - Consecutive comments collapse to the latest quote
// - Groups events under Today and Yesterday
//
// What is covered:
// - Happy path, snapshot, absolute due date, collapse, grouping
//
// Run with: pnpm test:run tests/lib/activityDisplay.test.ts
//
// SEE: src/lib/activityDisplay.ts

import { describe, it, expect } from 'vitest';

import type { ActivityEventView } from '@/lib/activityDisplay';
import {
  activityQuote,
  activitySentence,
  collapseActivityEvents,
  formatActivityDayLabel,
  formatActivityDue,
  groupActivityByDay,
} from '@/lib/activityDisplay';
import { activityCopy } from '@/lib/activityCopy';

const actor = { actorName: 'Ada Lovelace', actorUsername: 'ada' };

function view(
  partial: Partial<ActivityEventView> & Pick<ActivityEventView, 'id' | 'type' | 'payload'>,
): ActivityEventView {
  return {
    actorId: 'user-ada',
    createdAt: new Date('2026-08-25T14:20:00Z'),
    valid: true,
    ...partial,
  };
}

describe('activitySentence', () => {
  it('builds an English sentence from each event type', () => {
    expect(
      activitySentence(
        view({
          id: 'e1',
          type: 'CARD_CREATED',
          payload: {
            ...actor,
            cardId: 'c1',
            cardTitle: 'Define the home grid',
            columnId: 'col-todo',
            columnTitle: 'To do',
          },
        }),
      ),
    ).toBe('Ada Lovelace created "Define the home grid" in To do.');

    expect(
      activitySentence(
        view({
          id: 'e2',
          type: 'CARD_MOVED',
          payload: {
            ...actor,
            cardId: 'c1',
            cardTitle: 'Review signup',
            fromColumnId: 'col-todo',
            fromColumnTitle: 'To do',
            toColumnId: 'col-doing',
            toColumnTitle: 'In progress',
          },
        }),
      ),
    ).toBe('Ada Lovelace moved "Review signup" from To do to In progress.');

    expect(
      activitySentence(
        view({
          id: 'e3',
          type: 'CARD_ARCHIVED',
          payload: { ...actor, cardId: 'c1', cardTitle: 'Old task' },
        }),
      ),
    ).toBe('Ada Lovelace archived "Old task".');

    expect(
      activitySentence(
        view({
          id: 'e3b',
          type: 'CARD_RESTORED',
          payload: { ...actor, cardId: 'c1', cardTitle: 'Old task' },
        }),
      ),
    ).toBe('Ada Lovelace restored "Old task".');

    expect(
      activitySentence(
        view({
          id: 'e4',
          type: 'CARD_DELETED',
          payload: { ...actor, cardId: 'c1', cardTitle: 'Old task' },
        }),
      ),
    ).toBe('Ada Lovelace deleted "Old task".');

    expect(
      activitySentence(
        view({
          id: 'e5',
          type: 'ASSIGNEES_CHANGED',
          payload: {
            ...actor,
            cardId: 'c1',
            cardTitle: 'Write tests',
            assignees: [
              { id: 'u1', name: 'Grace Hopper', username: 'grace' },
              { id: 'u2', name: 'Alan Turing', username: 'alan' },
            ],
          },
        }),
      ),
    ).toBe('Ada Lovelace assigned Grace Hopper and Alan Turing to "Write tests".');

    expect(
      activitySentence(
        view({
          id: 'e6',
          type: 'LABEL_CHANGED',
          payload: {
            ...actor,
            cardId: 'c1',
            cardTitle: 'Empty copy',
            labelId: 'label-1',
            labelName: 'Content',
          },
        }),
      ),
    ).toBe('Ada Lovelace changed the label of "Empty copy" to Content.');

    expect(
      activitySentence(
        view({
          id: 'e7',
          type: 'COMMENT_ADDED',
          payload: {
            ...actor,
            cardId: 'c1',
            cardTitle: 'Safari bug',
            commentId: 'com-1',
            body: 'It only fails when the session expired.',
          },
        }),
      ),
    ).toBe('Ada Lovelace commented on "Safari bug".');

    expect(
      activitySentence(
        view({
          id: 'e8',
          type: 'MEMBER_ADDED',
          payload: {
            ...actor,
            memberId: 'user-ada',
            memberName: 'Ada Lovelace',
            memberUsername: 'ada',
            inviterId: 'user-grace',
            inviterName: 'Grace Hopper',
            inviterUsername: 'grace',
          },
        }),
      ),
    ).toBe('Ada Lovelace joined the project.');

    expect(
      activitySentence(
        view({
          id: 'e8-admin',
          type: 'MEMBER_ADDED',
          payload: {
            ...actor,
            memberId: 'user-ada',
            memberName: 'Ada Lovelace',
            memberUsername: 'ada',
            inviterId: 'user-grace',
            inviterName: 'Grace Hopper',
            inviterUsername: 'grace',
            role: 'ADMIN',
          },
        }),
      ),
    ).toBe('Ada Lovelace joined the project as an admin.');

    expect(
      activitySentence(
        view({
          id: 'e8-member',
          type: 'MEMBER_ADDED',
          payload: {
            ...actor,
            memberId: 'user-ada',
            memberName: 'Ada Lovelace',
            memberUsername: 'ada',
            inviterId: 'user-grace',
            inviterName: 'Grace Hopper',
            inviterUsername: 'grace',
            role: 'MEMBER',
          },
        }),
      ),
    ).toBe('Ada Lovelace joined the project as a member.');

    expect(
      activitySentence(
        view({
          id: 'e-project',
          type: 'PROJECT_CREATED',
          payload: { ...actor, projectTitle: 'Sprint board' },
        }),
      ),
    ).toBe('Ada Lovelace created "Sprint board".');

    expect(
      activitySentence(
        view({
          id: 'e9',
          type: 'MEMBER_REMOVED',
          payload: {
            ...actor,
            memberId: 'user-alan',
            memberName: 'Alan Turing',
            memberUsername: 'alan',
          },
        }),
      ),
    ).toBe('Ada Lovelace removed Alan Turing from the project.');

    expect(
      activitySentence(
        view({
          id: 'e-transfer',
          type: 'OWNERSHIP_TRANSFERRED',
          payload: {
            ...actor,
            memberId: 'user-max',
            memberName: 'Maxi',
            memberUsername: 'maxi',
          },
        }),
      ),
    ).toBe('Ada Lovelace transferred ownership to Maxi.');

    expect(
      activitySentence(
        view({
          id: 'e-left',
          type: 'MEMBER_LEFT',
          payload: { ...actor },
        }),
      ),
    ).toBe('Ada Lovelace left the project.');

    expect(
      activitySentence(
        view({
          id: 'e-promoted',
          type: 'MEMBER_PROMOTED',
          payload: {
            ...actor,
            memberId: 'user-max',
            memberName: 'Maxi',
            memberUsername: 'maxi',
          },
        }),
      ),
    ).toBe('Ada Lovelace made Maxi an admin.');

    expect(
      activitySentence(
        view({
          id: 'e-demoted',
          type: 'MEMBER_DEMOTED',
          payload: {
            ...actor,
            memberId: 'user-max',
            memberName: 'Maxi',
            memberUsername: 'maxi',
          },
        }),
      ),
    ).toBe('Ada Lovelace removed Maxi as an admin.');

    expect(
      activitySentence(
        view({
          id: 'e-archived',
          type: 'PROJECT_ARCHIVED',
          payload: { ...actor, projectTitle: 'Sprint board' },
        }),
      ),
    ).toBe('Ada Lovelace archived "Sprint board".');

    expect(
      activitySentence(
        view({
          id: 'e-restored',
          type: 'PROJECT_RESTORED',
          payload: { ...actor, projectTitle: 'Sprint board' },
        }),
      ),
    ).toBe('Ada Lovelace restored "Sprint board".');

    expect(
      activitySentence(
        view({
          id: 'e-deleted',
          type: 'PROJECT_DELETED',
          payload: { ...actor, projectTitle: 'Sprint board' },
        }),
      ),
    ).toBe('Ada Lovelace permanently deleted "Sprint board".');
  });

  it('keeps a snapshotted column name after a rename', () => {
    const sentence = activitySentence(
      view({
        id: 'e1',
        type: 'CARD_MOVED',
        payload: {
          ...actor,
          cardId: 'c1',
          cardTitle: 'Review signup',
          fromColumnId: 'col-todo',
          fromColumnTitle: 'To do',
          toColumnId: 'col-doing',
          toColumnTitle: 'In progress',
        },
      }),
    );
    expect(sentence).toContain('To do');
    expect(sentence).not.toContain('Backlog');
  });

  it('formats a due date as an absolute calendar day, not Today', () => {
    const due = formatActivityDue({ dueDate: '2026-08-25' });
    expect(due).toEqual({ label: '25 Aug 2026', zoneNote: null });
    expect(
      activitySentence(
        view({
          id: 'e1',
          type: 'DUE_DATE_CHANGED',
          payload: {
            ...actor,
            cardId: 'c1',
            cardTitle: 'Ship it',
            dueDate: '2026-08-25',
          },
        }),
      ),
    ).toBe('Ada Lovelace set the due date of "Ship it" to 25 Aug 2026.');
  });

  it('reads a due moment in the viewer zone and names the zone it was set in', () => {
    const event = view({
      id: 'e1',
      type: 'DUE_DATE_CHANGED',
      payload: {
        ...actor,
        cardId: 'c1',
        cardTitle: 'Ship it',
        dueDate: '2026-08-25',
        dueTime: '16:00',
        dueTimeZone: 'Europe/Madrid',
      },
    });

    expect(activitySentence(event, activityCopy, 'Europe/Madrid')).toBe(
      'Ada Lovelace set the due date of "Ship it" to 25 Aug 2026 at 4:00pm.',
    );
    expect(activitySentence(event, activityCopy, 'America/Argentina/Buenos_Aires')).toBe(
      'Ada Lovelace set the due date of "Ship it" to 25 Aug 2026 at 11:00am, Madrid time (GMT+02:00).',
    );
  });

  it('keeps the sentence of an event written before due dates could carry a time', () => {
    const event = view({
      id: 'e1',
      type: 'DUE_DATE_CHANGED',
      payload: { ...actor, cardId: 'c1', cardTitle: 'Ship it', dueDate: '2026-08-25' },
    });

    expect(activitySentence(event, activityCopy, 'America/Argentina/Buenos_Aires')).toBe(
      'Ada Lovelace set the due date of "Ship it" to 25 Aug 2026.',
    );
  });

  it('uses the fallback sentence when the payload is invalid', () => {
    expect(
      activitySentence(
        view({
          id: 'e1',
          type: 'CARD_CREATED',
          valid: false,
          payload: { actorName: 'Ada Lovelace' },
        }),
      ),
    ).toBe('Ada Lovelace updated the board.');
  });
});

describe('collapseActivityEvents', () => {
  it('collapses consecutive same-type edits on the same card', () => {
    const collapsed = collapseActivityEvents([
      view({
        id: 'newer',
        type: 'LABEL_CHANGED',
        createdAt: new Date('2026-08-25T14:22:00Z'),
        payload: {
          ...actor,
          cardId: 'c1',
          cardTitle: 'Empty copy',
          labelId: 'label-2',
          labelName: 'Content',
        },
      }),
      view({
        id: 'older',
        type: 'LABEL_CHANGED',
        createdAt: new Date('2026-08-25T14:21:00Z'),
        payload: {
          ...actor,
          cardId: 'c1',
          cardTitle: 'Empty copy',
          labelId: 'label-1',
          labelName: 'Design',
        },
      }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.payload.labelName).toBe('Content');
  });

  it('reads a collapsed move as the first from-column to the last to-column', () => {
    const collapsed = collapseActivityEvents([
      view({
        id: 'c',
        type: 'CARD_MOVED',
        createdAt: new Date('2026-08-25T14:23:00Z'),
        payload: {
          ...actor,
          cardId: 'c1',
          cardTitle: 'Review signup',
          fromColumnId: 'col-doing',
          fromColumnTitle: 'In progress',
          toColumnId: 'col-done',
          toColumnTitle: 'Done',
        },
      }),
      view({
        id: 'b',
        type: 'CARD_MOVED',
        createdAt: new Date('2026-08-25T14:22:00Z'),
        payload: {
          ...actor,
          cardId: 'c1',
          cardTitle: 'Review signup',
          fromColumnId: 'col-todo',
          fromColumnTitle: 'To do',
          toColumnId: 'col-doing',
          toColumnTitle: 'In progress',
        },
      }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(activitySentence(collapsed[0]!)).toBe(
      'Ada Lovelace moved "Review signup" from To do to Done.',
    );
  });

  it('does not collapse member events', () => {
    const collapsed = collapseActivityEvents([
      view({
        id: 'newer',
        type: 'MEMBER_REMOVED',
        createdAt: new Date('2026-08-25T14:22:00Z'),
        payload: {
          ...actor,
          memberId: 'user-alan',
          memberName: 'Alan Turing',
          memberUsername: 'alan',
        },
      }),
      view({
        id: 'older',
        type: 'MEMBER_REMOVED',
        createdAt: new Date('2026-08-25T14:21:00Z'),
        payload: {
          ...actor,
          memberId: 'user-grace',
          memberName: 'Grace Hopper',
          memberUsername: 'grace',
        },
      }),
    ]);
    expect(collapsed).toHaveLength(2);
  });

  it('collapses consecutive comments to the latest quote', () => {
    const collapsed = collapseActivityEvents([
      view({
        id: 'newer',
        type: 'COMMENT_ADDED',
        createdAt: new Date('2026-08-25T14:22:00Z'),
        payload: {
          ...actor,
          cardId: 'c1',
          cardTitle: 'Safari bug',
          commentId: 'com-2',
          body: 'Latest note',
        },
      }),
      view({
        id: 'older',
        type: 'COMMENT_ADDED',
        createdAt: new Date('2026-08-25T14:21:00Z'),
        payload: {
          ...actor,
          cardId: 'c1',
          cardTitle: 'Safari bug',
          commentId: 'com-1',
          body: 'First note',
        },
      }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(activityQuote(collapsed[0]!)).toBe('Latest note');
  });
});

describe('groupActivityByDay', () => {
  it('groups events under Today and Yesterday', () => {
    const now = new Date('2026-08-25T18:00:00');
    const groups = groupActivityByDay(
      [
        view({
          id: 'today',
          type: 'CARD_CREATED',
          createdAt: new Date('2026-08-25T14:20:00'),
          payload: {
            ...actor,
            cardId: 'c1',
            cardTitle: 'A',
            columnId: 'col',
            columnTitle: 'To do',
          },
        }),
        view({
          id: 'yesterday',
          type: 'CARD_CREATED',
          createdAt: new Date('2026-08-24T10:00:00'),
          payload: {
            ...actor,
            cardId: 'c2',
            cardTitle: 'B',
            columnId: 'col',
            columnTitle: 'To do',
          },
        }),
      ],
      now,
    );
    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday']);
    expect(formatActivityDayLabel(new Date('2026-08-25T01:00:00'), now)).toBe(activityCopy.today);
  });
});
