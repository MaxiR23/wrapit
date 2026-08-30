// tests/actions/updateCardField.test.ts
//
// Tests for the updateCardField server action.
//
// Tested:
// - Updates the title and returns the trimmed value
// - Rejects an empty title with a clear field error
// - Clears the description to null and returns an empty value
// - Persists a YYYY-MM-DD due date and clears it when empty
// - Resolves a wall time in the sender's zone to an instant
// - Keeps the stored zone when a save from elsewhere lands on the same instant
// - Takes the sender's zone when the instant actually changes
// - Clears the zone when a moment is downgraded to a calendar day
// - Stamps a zone when a calendar day is upgraded to the same instant
// - Rejects an invalid due date with a field error
// - Rejects updating a card the user does not own
// - Rejects the call when there is no session
// - Rejects an empty, oversized, or non-string card id without a lookup
// - Returns a generic error when Prisma fails unexpectedly
//
// What is covered:
// - Happy path, invalid input, ownership, unauthorized, unexpected Prisma failure, invalid id,
//   zone resolution and zone provenance across viewers in different zones
//
// Run with: pnpm test:run tests/actions/updateCardField.test.ts
//
// SEE: src/actions/updateCardField.ts

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

const { updateCardField } = await import('@/actions/updateCardField');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada', username: 'ada' };

const TZ_MADRID = 'Europe/Madrid';
const TZ_BUENOS_AIRES = 'America/Argentina/Buenos_Aires';

/** 2026-08-25 16:00 in Madrid, which is 11:00 in Buenos Aires. */
const MADRID_INSTANT = new Date(Date.UTC(2026, 7, 25, 14, 0));

async function seedOwnedCard() {
  const project = await seedAccessibleProject(db, {
    title: 'Sprint board',
    userId: sessionUser.id,
  });
  const column = await db.column.create({
    data: { title: 'To do', order: 1, projectId: project.id },
  });
  const card = await db.card.create({
    data: {
      title: 'Old title',
      description: 'Old description',
      order: 1,
      columnId: column.id,
    },
  });
  return { project, column, card };
}

/** A card whose due date is a real moment set by someone in Madrid. */
async function seedMadridCard() {
  const seeded = await seedOwnedCard();
  await db.card.update({
    where: { id: seeded.card.id },
    data: { dueDate: MADRID_INSTANT, dueTimeZone: TZ_MADRID },
  });
  return seeded;
}

describe('updateCardField', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
  });

  it('updates the title and returns the trimmed value', async () => {
    const { project, card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'title',
      value: '  New title  ',
    });

    expect(result).toEqual({ data: { value: 'New title' } });
    expect(db.card.rows[0]?.title).toBe('New title');
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('stores markdown in the title and description exactly as typed', async () => {
    const { card } = await seedOwnedCard();

    const titled = await updateCardField({
      cardId: card.id,
      field: 'title',
      value: '**Keep stars**',
    });
    expect(titled).toEqual({ data: { value: '**Keep stars**' } });
    expect(db.card.rows[0]?.title).toBe('**Keep stars**');

    const described = await updateCardField({
      cardId: card.id,
      field: 'description',
      value: '```\nconst n = 1;\n```',
    });
    expect(described).toEqual({ data: { value: '```\nconst n = 1;\n```' } });
    expect(db.card.rows[0]?.description).toBe('```\nconst n = 1;\n```');
  });

  it('rejects an empty title with a clear field error', async () => {
    const { card } = await seedOwnedCard();

    const result = await updateCardField({ cardId: card.id, field: 'title', value: '' });

    expect(result).toEqual({ fieldErrors: { value: 'Title is required' } });
    expect(db.card.rows[0]?.title).toBe('Old title');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('writes null for an empty description and returns an empty value', async () => {
    const { project, card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'description',
      value: '   ',
    });

    expect(result).toEqual({ data: { value: '' } });
    expect(db.card.rows[0]?.description).toBeNull();
    expect(db.activityEvent.rows).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('persists a calendar due date and clears it when the value is empty', async () => {
    const { project, card } = await seedOwnedCard();

    const persisted = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
    });

    expect(persisted).toEqual({
      data: { value: '2026-08-25', dueDate: new Date(Date.UTC(2026, 7, 25)), dueTimeZone: null },
    });
    expect(db.card.rows[0]?.dueDate).toEqual(new Date(Date.UTC(2026, 7, 25)));
    expect(db.card.rows[0]?.dueTimeZone).toBeNull();
    expect(db.activityEvent.rows).toHaveLength(1);
    expect(db.activityEvent.rows[0]).toEqual(
      expect.objectContaining({
        type: 'DUE_DATE_CHANGED',
        payload: expect.objectContaining({
          dueDate: '2026-08-25',
          dueTime: null,
          dueTimeZone: null,
          cardTitle: 'Old title',
        }),
      }),
    );

    const cleared = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '',
    });

    expect(cleared).toEqual({ data: { value: '', dueDate: null, dueTimeZone: null } });
    expect(db.card.rows[0]?.dueDate).toBeNull();
    expect(db.activityEvent.rows).toHaveLength(2);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('does not write an event when the due date is unchanged', async () => {
    const { card } = await seedOwnedCard();
    await db.card.update({
      where: { id: card.id },
      data: { dueDate: new Date(Date.UTC(2026, 7, 25)) },
    });

    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
    });

    expect(result).toEqual({
      data: { value: '2026-08-25', dueDate: new Date(Date.UTC(2026, 7, 25)), dueTimeZone: null },
    });
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('rejects an invalid due date with a field error', async () => {
    const { card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '25 ago',
    });

    expect(result).toEqual({ fieldErrors: { value: 'Enter a valid date' } });
    expect(db.card.rows[0]?.dueDate).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('resolves a wall time in the sender zone to an instant', async () => {
    const { card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
      time: '16:00',
      timeZone: TZ_MADRID,
    });

    expect(result).toEqual({
      data: {
        value: '2026-08-25T16:00',
        dueDate: MADRID_INSTANT,
        dueTimeZone: TZ_MADRID,
      },
    });
    expect(db.card.rows[0]?.dueDate).toEqual(MADRID_INSTANT);
    expect(db.card.rows[0]?.dueTimeZone).toBe(TZ_MADRID);
    expect(db.activityEvent.rows[0]).toEqual(
      expect.objectContaining({
        type: 'DUE_DATE_CHANGED',
        payload: expect.objectContaining({
          dueDate: '2026-08-25',
          dueTime: '16:00',
          dueTimeZone: TZ_MADRID,
        }),
      }),
    );
  });

  it('keeps the stored zone when a save from another zone lands on the same instant', async () => {
    const { card } = await seedMadridCard();

    // 16:00 in Madrid is 11:00 in Buenos Aires: the same moment, retyped.
    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
      time: '11:00',
      timeZone: TZ_BUENOS_AIRES,
    });

    expect(result).toEqual({
      data: {
        value: '2026-08-25T11:00',
        dueDate: MADRID_INSTANT,
        dueTimeZone: TZ_MADRID,
      },
    });
    expect(db.card.rows[0]?.dueDate).toEqual(MADRID_INSTANT);
    expect(db.card.rows[0]?.dueTimeZone).toBe(TZ_MADRID);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('takes the sender zone when the instant actually changes', async () => {
    const { card } = await seedMadridCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
      time: '12:00',
      timeZone: TZ_BUENOS_AIRES,
    });

    const moved = new Date(Date.UTC(2026, 7, 25, 15, 0));
    expect(result).toEqual({
      data: {
        value: '2026-08-25T12:00',
        dueDate: moved,
        dueTimeZone: TZ_BUENOS_AIRES,
      },
    });
    expect(db.card.rows[0]?.dueDate).toEqual(moved);
    expect(db.card.rows[0]?.dueTimeZone).toBe(TZ_BUENOS_AIRES);
    expect(db.activityEvent.rows).toHaveLength(1);
  });

  it('clears the zone when a moment is downgraded to a calendar day', async () => {
    const { card } = await seedMadridCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
    });

    expect(result).toEqual({
      data: { value: '2026-08-25', dueDate: new Date(Date.UTC(2026, 7, 25)), dueTimeZone: null },
    });
    expect(db.card.rows[0]?.dueTimeZone).toBeNull();
    expect(db.activityEvent.rows).toHaveLength(1);
  });

  it('stamps a zone when a calendar day is upgraded to the same instant', async () => {
    const { card } = await seedOwnedCard();
    await db.card.update({
      where: { id: card.id },
      data: { dueDate: new Date(Date.UTC(2026, 7, 25)), dueTimeZone: null },
    });

    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
      time: '00:00',
      timeZone: 'UTC',
    });

    expect(result).toEqual({
      data: {
        value: '2026-08-25T00:00',
        dueDate: new Date(Date.UTC(2026, 7, 25)),
        dueTimeZone: 'UTC',
      },
    });
    expect(db.card.rows[0]?.dueTimeZone).toBe('UTC');
    expect(db.activityEvent.rows).toHaveLength(1);
  });

  it('rejects a time the schema does not accept', async () => {
    const { card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
      time: '25:00',
      timeZone: TZ_MADRID,
    });

    expect(result).toEqual({ fieldErrors: { value: 'Enter a valid time' } });
    expect(db.card.rows[0]?.dueDate).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects updating a card the user does not own', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });

    const result = await updateCardField({
      cardId: card.id,
      field: 'title',
      value: 'Hijacked',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.card.rows[0]?.title).toBe('Stolen');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const { card } = await seedOwnedCard();

    const result = await updateCardField({
      cardId: card.id,
      field: 'title',
      value: 'New title',
    });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid card id without a lookup', async () => {
    db.card.findFirst.mockClear();

    expect(await updateCardField({ cardId: '', field: 'title', value: 'New title' })).toEqual({
      error: 'Unauthorized',
    });
    expect(await updateCardField({ cardId: '   ', field: 'title', value: 'New title' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await updateCardField({
        cardId: 'a'.repeat(MAX_ID_LENGTH + 1),
        field: 'title',
        value: 'New title',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(
      await updateCardField({
        cardId: 1 as unknown as string,
        field: 'title',
        value: 'New title',
      }),
    ).toEqual({ error: 'Unauthorized' });
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const { card } = await seedOwnedCard();
    const leakyMessage =
      'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused for user "wrapit"';
    db.card.updateMany.mockRejectedValueOnce(new Error(leakyMessage));

    const result = await updateCardField({
      cardId: card.id,
      field: 'title',
      value: 'New title',
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(result).not.toEqual(expect.objectContaining({ error: leakyMessage }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back the due date when logging fails', async () => {
    const { card } = await seedOwnedCard();
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await updateCardField({
      cardId: card.id,
      field: 'dueDate',
      value: '2026-08-25',
    });

    expect(result).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(db.card.rows[0]?.dueDate).toBeUndefined();
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
