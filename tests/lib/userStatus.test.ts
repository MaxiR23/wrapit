// tests/lib/userStatus.test.ts
//
// Tests for reading user statuses, seeding defaults, and the last-status guard.
//
// Tested:
// - Seeds four defaults and points activeStatusId at the first row when none exist
// - Returns stored rows without inserting when the user already has statuses
// - Heals a null or unknown activeStatusId to the lowest-order row
// - Retries the read when a concurrent seed hits the unique order constraint
// - Does not create rows for another user
// - parseUserStatusTone / nextUserStatusTone / tone classes
// - assertNotLastStatus throws after a delete that emptied the list
//
// What is covered:
// - Seed, existing rows, heal, concurrent unique, isolation, tones, last-status guard
//
// Run with: pnpm test:run tests/lib/userStatus.test.ts
//
// SEE: src/lib/userStatus.ts, src/lib/userStatuses.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const {
  DEFAULT_USER_STATUSES,
  LastStatusError,
  assertNotLastStatus,
  nextUserStatusTone,
  parseUserStatusTone,
  statusFromRow,
  userStatusToneClasses,
  userStatusToneForIndex,
} = await import('@/lib/userStatus');
const { getUserStatusesForUser } = await import('@/lib/userStatuses');

const ada = {
  id: 'user-ada',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  username: 'ada',
};

const other = {
  id: 'user-other',
  email: 'other@example.com',
  name: 'Other',
  username: 'other',
};

async function seedStored(userId: string) {
  const rows = [];
  for (const status of DEFAULT_USER_STATUSES) {
    rows.push(
      await db.userStatus.create({
        data: { ...status, userId },
      }),
    );
  }
  await db.user.update({
    where: { id: userId },
    data: { activeStatusId: rows[0]?.id },
  });
  return rows;
}

describe('parseUserStatusTone', () => {
  it('maps known keys and everything else to green', () => {
    expect(parseUserStatusTone('blue')).toBe('blue');
    expect(parseUserStatusTone('violet')).toBe('violet');
    expect(parseUserStatusTone('secret')).toBe('green');
    expect(parseUserStatusTone(undefined)).toBe('green');
  });
});

describe('nextUserStatusTone', () => {
  it('walks the six tones and wraps from violet to green', () => {
    expect(nextUserStatusTone('green')).toBe('gray');
    expect(nextUserStatusTone('gray')).toBe('red');
    expect(nextUserStatusTone('red')).toBe('amber');
    expect(nextUserStatusTone('amber')).toBe('blue');
    expect(nextUserStatusTone('blue')).toBe('violet');
    expect(nextUserStatusTone('violet')).toBe('green');
  });
});

describe('userStatusToneForIndex', () => {
  it('picks the next palette tone from the current count', () => {
    expect(userStatusToneForIndex(0)).toBe('green');
    expect(userStatusToneForIndex(4)).toBe('blue');
    expect(userStatusToneForIndex(6)).toBe('green');
  });
});

describe('userStatusToneClasses', () => {
  it('returns token classes without bare hex or oklch', () => {
    const classes = userStatusToneClasses('green');
    expect(classes.pill).toContain('text-user-status-green');
    expect(classes.pill).toContain('bg-user-status-green/14');
    expect(classes.swatch).toContain('bg-user-status-green/30');
    expect(JSON.stringify(classes)).not.toMatch(/#|oklch/i);
  });
});

describe('statusFromRow', () => {
  it('normalizes a stored row onto the view shape', () => {
    expect(
      statusFromRow({
        id: 's1',
        name: 'Active',
        description: 'Available for the team',
        color: 'green',
        order: 0,
      }),
    ).toEqual({
      id: 's1',
      name: 'Active',
      description: 'Available for the team',
      color: 'green',
      order: 0,
    });
  });
});

describe('getUserStatusesForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('seeds four defaults and points activeStatusId at the first row', async () => {
    await db.user.create({ data: ada });

    const view = await getUserStatusesForUser(ada.id);

    expect(view?.statuses).toHaveLength(4);
    expect(view?.statuses.map((status) => status.name)).toEqual([
      'Active',
      'Inactive',
      'Do not disturb',
      'Out of office',
    ]);
    expect(view?.statuses.map((status) => status.color)).toEqual(['green', 'gray', 'red', 'amber']);
    expect(view?.statuses.map((status) => status.order)).toEqual([0, 1, 2, 3]);
    expect(view?.statuses[0]?.description).toBe('Available for the team');
    expect(view?.activeStatusId).toBe(view?.statuses[0]?.id);
    expect(db.user.rows[0]?.activeStatusId).toBe(view?.statuses[0]?.id);
  });

  it('returns stored rows without inserting when statuses already exist', async () => {
    await db.user.create({ data: ada });
    const rows = await seedStored(ada.id);

    const view = await getUserStatusesForUser(ada.id);

    expect(view?.statuses).toHaveLength(4);
    expect(view?.activeStatusId).toBe(rows[0]?.id);
    expect(db.userStatus.rows).toHaveLength(4);
  });

  it('heals a null activeStatusId to the lowest-order row', async () => {
    await db.user.create({ data: { ...ada, activeStatusId: null } });
    await seedStored(ada.id);
    await db.user.update({ where: { id: ada.id }, data: { activeStatusId: null } });

    const view = await getUserStatusesForUser(ada.id);

    expect(view?.activeStatusId).toBe(view?.statuses[0]?.id);
    expect(db.user.rows[0]?.activeStatusId).toBe(view?.statuses[0]?.id);
  });

  it('retries the read when a concurrent seed hits the unique order constraint', async () => {
    await db.user.create({ data: ada });
    await seedStored(ada.id);
    db.userStatus.findMany.mockResolvedValueOnce([]);
    db.userStatus.createMany.mockRejectedValueOnce(new Error('unique constraint'));

    const view = await getUserStatusesForUser(ada.id);

    expect(view?.statuses).toHaveLength(4);
    expect(db.userStatus.rows).toHaveLength(4);
  });

  it('does not create statuses for another user', async () => {
    await db.user.create({ data: ada });
    await db.user.create({ data: other });
    await seedStored(other.id);

    const view = await getUserStatusesForUser(ada.id);

    expect(view?.statuses).toHaveLength(4);
    expect(db.userStatus.rows.filter((row) => row.userId === other.id)).toHaveLength(4);
    expect(db.userStatus.rows.filter((row) => row.userId === ada.id)).toHaveLength(4);
  });

  it('returns null when the user does not exist', async () => {
    await expect(getUserStatusesForUser('missing')).resolves.toBeNull();
    expect(db.userStatus.rows).toHaveLength(0);
  });
});

describe('assertNotLastStatus', () => {
  beforeEach(() => {
    db.reset();
  });

  it('throws LastStatusError when no statuses remain and does not insert', async () => {
    await db.user.create({ data: ada });

    await expect(assertNotLastStatus(db, ada.id)).rejects.toEqual(expect.any(LastStatusError));
    await expect(assertNotLastStatus(db, ada.id)).rejects.toThrow('Cannot delete the last status');
    expect(db.userStatus.rows).toHaveLength(0);
  });

  it('does not throw when at least one status remains', async () => {
    await db.user.create({ data: ada });
    await db.userStatus.create({
      data: { userId: ada.id, name: 'Active', description: '', color: 'green', order: 0 },
    });

    await expect(assertNotLastStatus(db, ada.id)).resolves.toBeUndefined();
  });
});
