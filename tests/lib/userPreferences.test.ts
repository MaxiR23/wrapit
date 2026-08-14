// tests/lib/userPreferences.test.ts
//
// Tests for reading user preferences and mapping Prisma viewMode values.
//
// Tested:
// - Returns the stored viewMode when a preferences row exists
// - Falls back to GRID when the user has no preferences row
// - Maps unknown Prisma values to grid
//
// What is covered:
// - Stored LIST, missing row, unknown viewMode
//
// Run with: pnpm test:run tests/lib/userPreferences.test.ts
//
// SEE: src/lib/userPreferences.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { getUserPreferences, parseViewMode, preferencesFromRow, toPrismaViewMode } =
  await import('@/lib/userPreferences');

describe('parseViewMode', () => {
  it('maps LIST to list and everything else to grid', () => {
    expect(parseViewMode('LIST')).toBe('list');
    expect(parseViewMode('GRID')).toBe('grid');
    expect(parseViewMode('kanban')).toBe('grid');
    expect(parseViewMode(undefined)).toBe('grid');
  });
});

describe('toPrismaViewMode', () => {
  it('maps UI values to Prisma enum members', () => {
    expect(toPrismaViewMode('list')).toBe('LIST');
    expect(toPrismaViewMode('grid')).toBe('GRID');
  });
});

describe('preferencesFromRow', () => {
  it('falls back to grid when the row is missing or viewMode is unknown', () => {
    expect(preferencesFromRow(null)).toEqual({ viewMode: 'grid' });
    expect(preferencesFromRow({ viewMode: 'kanban' })).toEqual({ viewMode: 'grid' });
  });
});

describe('getUserPreferences', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns the stored viewMode when a preferences row exists', async () => {
    await db.userPreferences.create({
      data: { userId: 'user-ada', viewMode: 'LIST' },
    });

    await expect(getUserPreferences('user-ada')).resolves.toEqual({ viewMode: 'list' });
  });

  it('falls back to GRID when no row exists', async () => {
    await expect(getUserPreferences('user-ada')).resolves.toEqual({ viewMode: 'grid' });
    expect(db.userPreferences.rows).toHaveLength(0);
  });
});
