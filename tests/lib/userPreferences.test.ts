// tests/lib/userPreferences.test.ts
//
// Tests for reading user preferences and mapping Prisma viewMode and board
// visibility values.
//
// Tested:
// - Returns the stored viewMode when a preferences row exists
// - Falls back to GRID and all-visible flags when the user has no preferences row
// - Maps unknown Prisma values to grid
// - Maps stored false flags to hidden fields and everything else to shown
//
// What is covered:
// - Stored LIST, missing row, unknown viewMode, board visibility defaults
//
// Run with: pnpm test:run tests/lib/userPreferences.test.ts
//
// SEE: src/lib/userPreferences.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DEFAULT_BOARD_VISIBILITY } from '@/lib/boardView';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const {
  getUserPreferences,
  parseViewMode,
  preferencesFromRow,
  toPrismaViewMode,
  boardVisibilityFromRow,
  parseBoardVisibilityFlag,
} = await import('@/lib/userPreferences');

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

describe('parseBoardVisibilityFlag', () => {
  it('hides a field only when the stored value is false', () => {
    expect(parseBoardVisibilityFlag(false)).toBe(false);
    expect(parseBoardVisibilityFlag(true)).toBe(true);
    expect(parseBoardVisibilityFlag(undefined)).toBe(true);
    expect(parseBoardVisibilityFlag('no')).toBe(true);
  });
});

describe('preferencesFromRow', () => {
  it('falls back to grid and all-visible flags when the row is missing or viewMode is unknown', () => {
    expect(preferencesFromRow(null)).toEqual({
      viewMode: 'grid',
      boardVisibility: DEFAULT_BOARD_VISIBILITY,
    });
    expect(preferencesFromRow({ viewMode: 'kanban' })).toEqual({
      viewMode: 'grid',
      boardVisibility: DEFAULT_BOARD_VISIBILITY,
    });
  });
});

describe('boardVisibilityFromRow', () => {
  it('maps stored false flags to hidden fields', () => {
    expect(
      boardVisibilityFromRow({
        showCardLabel: false,
        showCardCode: true,
        showCardComments: false,
        showCardSubtasks: true,
        showCardDueDate: false,
        showCardAssignees: true,
      }),
    ).toEqual({
      label: false,
      code: true,
      comments: false,
      subtasks: true,
      dueDate: false,
      assignees: true,
    });
  });
});

describe('getUserPreferences', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns the stored viewMode and visibility when a preferences row exists', async () => {
    await db.userPreferences.create({
      data: { userId: 'user-ada', viewMode: 'LIST', showCardLabel: false },
    });

    await expect(getUserPreferences('user-ada')).resolves.toEqual({
      viewMode: 'list',
      boardVisibility: { ...DEFAULT_BOARD_VISIBILITY, label: false },
    });
  });

  it('falls back to GRID and all-visible flags when no row exists', async () => {
    await expect(getUserPreferences('user-ada')).resolves.toEqual({
      viewMode: 'grid',
      boardVisibility: DEFAULT_BOARD_VISIBILITY,
    });
    expect(db.userPreferences.rows).toHaveLength(0);
  });
});
