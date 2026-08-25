// tests/lib/validation/card.test.ts
//
// Tests for the card field validation.
//
// Tested:
// - Reports no errors for a non-empty title
// - Reports an error when the title is empty
// - Allows a missing or empty description
// - Accepts an optional calendar due date on create
// - Rejects a malformed due date and an invalid assignee id
// - Accepts an optional due time paired with a real IANA zone
// - Rejects a malformed time, an offset or nonsense zone, and half-given pairs
// - Requires a title and a valid due date format on field updates; empty due is ok
// - Rejects a time or zone sent alongside a non-due field
// - Rejects bad assignee ids on assignee updates
// - Accepts a null labelId on label updates
//
// What is covered:
// - Happy path, invalid title, optional description, create due date and assignee ids,
//   due time and zone shapes and their cross-field rules,
//   field/assignee/label update schemas
//
// Run with: pnpm test:run tests/lib/validation/card.test.ts
//
// SEE: src/lib/validation/card.ts

import { describe, it, expect } from 'vitest';

import {
  createCardSchema,
  DUE_DATE_MESSAGE,
  DUE_TIME_MESSAGE,
  DUE_TIME_ZONE_MESSAGE,
  updateCardAssigneesSchema,
  updateCardFieldSchema,
  updateCardLabelSchema,
  validateCard,
} from '@/lib/validation/card';
import { MAX_ID_LENGTH } from '@/lib/validation/id';

describe('validateCard', () => {
  it('reports no errors for a non-empty title', () => {
    expect(validateCard({ title: 'Write tests' })).toEqual({});
  });

  it('reports an error when the title is empty', () => {
    expect(validateCard({ title: '' }).title).toBe('Title is required');
  });

  it('reports an error when the title is only whitespace', () => {
    expect(validateCard({ title: '   ' }).title).toBe('Title is required');
  });

  it('allows a missing description', () => {
    expect(validateCard({ title: 'Write tests' })).toEqual({});
  });

  it('allows an empty description', () => {
    expect(validateCard({ title: 'Write tests', description: '' })).toEqual({});
  });

  it('allows a non-empty description', () => {
    expect(validateCard({ title: 'Write tests', description: 'Cover ownership' })).toEqual({});
  });
});

describe('createCardSchema', () => {
  const base = { columnId: 'column-1', title: 'Write tests' };

  it('accepts an optional calendar due date', () => {
    expect(createCardSchema.safeParse({ ...base, dueDate: '2026-08-25' }).success).toBe(true);
    expect(createCardSchema.safeParse({ ...base, dueDate: '' }).success).toBe(true);
  });

  it('rejects a malformed due date', () => {
    const result = createCardSchema.safeParse({ ...base, dueDate: '25 ago' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(DUE_DATE_MESSAGE);
  });

  it('rejects an assignee id that is empty or oversized', () => {
    expect(createCardSchema.safeParse({ ...base, assigneeIds: [''] }).success).toBe(false);
    expect(
      createCardSchema.safeParse({ ...base, assigneeIds: ['a'.repeat(MAX_ID_LENGTH + 1)] }).success,
    ).toBe(false);
  });

  it('accepts a due time paired with a real IANA zone', () => {
    const result = createCardSchema.safeParse({
      ...base,
      dueDate: '2026-08-25',
      dueTime: '14:30',
      dueTimeZone: 'Europe/Madrid',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a malformed due time', () => {
    const result = createCardSchema.safeParse({
      ...base,
      dueDate: '2026-08-25',
      dueTime: '25:00',
      dueTimeZone: 'Europe/Madrid',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(DUE_TIME_MESSAGE);
  });

  it('rejects an offset or a zone this runtime does not know', () => {
    for (const dueTimeZone of ['+05:00', 'Not/AZone']) {
      const result = createCardSchema.safeParse({
        ...base,
        dueDate: '2026-08-25',
        dueTime: '14:30',
        dueTimeZone,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues[0]?.message).toBe(DUE_TIME_ZONE_MESSAGE);
    }
  });

  it('rejects a time without a date', () => {
    const result = createCardSchema.safeParse({
      ...base,
      dueTime: '14:30',
      dueTimeZone: 'Europe/Madrid',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a time without a zone', () => {
    const result = createCardSchema.safeParse({
      ...base,
      dueDate: '2026-08-25',
      dueTime: '14:30',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a zone without a time, since a calendar day carries no zone', () => {
    const result = createCardSchema.safeParse({
      ...base,
      dueDate: '2026-08-25',
      dueTimeZone: 'Europe/Madrid',
    });

    expect(result.success).toBe(false);
  });
});

describe('updateCardFieldSchema', () => {
  it('requires a title when the field is title', () => {
    const empty = updateCardFieldSchema.safeParse({
      cardId: 'card-1',
      field: 'title',
      value: '',
    });
    expect(empty.success).toBe(false);
    if (empty.success) return;
    expect(empty.error.issues[0]?.message).toBe('Title is required');

    const whitespace = updateCardFieldSchema.safeParse({
      cardId: 'card-1',
      field: 'title',
      value: '   ',
    });
    expect(whitespace.success).toBe(false);
  });

  it('rejects a malformed due date', () => {
    const result = updateCardFieldSchema.safeParse({
      cardId: 'card-1',
      field: 'dueDate',
      value: '25 ago',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(DUE_DATE_MESSAGE);
  });

  it('accepts an empty due date', () => {
    expect(
      updateCardFieldSchema.safeParse({ cardId: 'card-1', field: 'dueDate', value: '' }).success,
    ).toBe(true);
  });

  it('accepts a due time paired with a real IANA zone', () => {
    const result = updateCardFieldSchema.safeParse({
      cardId: 'card-1',
      field: 'dueDate',
      value: '2026-08-25',
      time: '14:30',
      timeZone: 'Europe/Madrid',
    });

    expect(result.success).toBe(true);
  });

  it('reports a malformed time and an unknown zone on the due field', () => {
    const badTime = updateCardFieldSchema.safeParse({
      cardId: 'card-1',
      field: 'dueDate',
      value: '2026-08-25',
      time: '25:00',
      timeZone: 'Europe/Madrid',
    });
    expect(badTime.success).toBe(false);
    if (badTime.success) return;
    expect(badTime.error.issues[0]?.path[0]).toBe('value');
    expect(badTime.error.issues[0]?.message).toBe(DUE_TIME_MESSAGE);

    const badZone = updateCardFieldSchema.safeParse({
      cardId: 'card-1',
      field: 'dueDate',
      value: '2026-08-25',
      time: '14:30',
      timeZone: 'Not/AZone',
    });
    expect(badZone.success).toBe(false);
    if (badZone.success) return;
    expect(badZone.error.issues[0]?.path[0]).toBe('value');
    expect(badZone.error.issues[0]?.message).toBe(DUE_TIME_ZONE_MESSAGE);
  });

  it('rejects a half-given time and zone pair', () => {
    expect(
      updateCardFieldSchema.safeParse({
        cardId: 'card-1',
        field: 'dueDate',
        value: '2026-08-25',
        time: '14:30',
      }).success,
    ).toBe(false);
    expect(
      updateCardFieldSchema.safeParse({
        cardId: 'card-1',
        field: 'dueDate',
        value: '2026-08-25',
        timeZone: 'Europe/Madrid',
      }).success,
    ).toBe(false);
    expect(
      updateCardFieldSchema.safeParse({
        cardId: 'card-1',
        field: 'dueDate',
        value: '',
        time: '14:30',
        timeZone: 'Europe/Madrid',
      }).success,
    ).toBe(false);
  });

  it('rejects a time or zone sent alongside a field that is not the due date', () => {
    expect(
      updateCardFieldSchema.safeParse({
        cardId: 'card-1',
        field: 'title',
        value: 'Write tests',
        time: '14:30',
        timeZone: 'Europe/Madrid',
      }).success,
    ).toBe(false);
  });
});

describe('updateCardAssigneesSchema', () => {
  it('rejects an assignee id that is empty or oversized', () => {
    expect(
      updateCardAssigneesSchema.safeParse({ cardId: 'card-1', assigneeIds: [''] }).success,
    ).toBe(false);
    expect(
      updateCardAssigneesSchema.safeParse({
        cardId: 'card-1',
        assigneeIds: ['a'.repeat(MAX_ID_LENGTH + 1)],
      }).success,
    ).toBe(false);
    expect(
      updateCardAssigneesSchema.safeParse({ cardId: '', assigneeIds: ['user-ada'] }).success,
    ).toBe(false);
  });
});

describe('updateCardLabelSchema', () => {
  it('accepts a null labelId', () => {
    expect(updateCardLabelSchema.safeParse({ cardId: 'card-1', labelId: null }).success).toBe(true);
  });
});
