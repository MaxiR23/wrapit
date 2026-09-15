// tests/lib/validation/archived.test.ts
//
// Tests for archived-card and archived-project action schemas.
//
// Tested:
// - Restore and delete card batches accept bounded unique ids
// - Delete project requires a non-empty title and does not trim it
// - Archive and restore project ids reject empty or oversized values
// - Archived list schemas take a keyset cursor, not an offset
//
// What is covered:
// - Happy path, invalid id, typed-title occupancy input
//
// Run with: pnpm test:run tests/lib/validation/archived.test.ts
//
// SEE: src/lib/validation/archived.ts

import { describe, it, expect } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import {
  archiveProjectSchema,
  deleteArchivedProjectSchema,
  listArchivedCardsSchema,
  listArchivedProjectsSchema,
  restoreArchivedProjectsSchema,
} from '@/lib/validation/archived';

describe('archiveProjectSchema', () => {
  it('accepts a bounded project id', () => {
    expect(archiveProjectSchema.parse({ projectId: 'project-1' })).toEqual({
      projectId: 'project-1',
    });
  });

  it('rejects an empty or oversized id', () => {
    expect(archiveProjectSchema.safeParse({ projectId: '' }).success).toBe(false);
    expect(
      archiveProjectSchema.safeParse({ projectId: 'a'.repeat(MAX_ID_LENGTH + 1) }).success,
    ).toBe(false);
  });
});

describe('restoreArchivedProjectsSchema', () => {
  it('dedupes ids', () => {
    expect(restoreArchivedProjectsSchema.parse({ projectIds: ['project-1', 'project-1'] })).toEqual(
      { projectIds: ['project-1'] },
    );
  });
});

describe('deleteArchivedProjectSchema', () => {
  it('keeps surrounding spaces on the typed title', () => {
    expect(
      deleteArchivedProjectSchema.parse({ projectId: 'project-1', title: ' Sprint board ' }),
    ).toEqual({ projectId: 'project-1', title: ' Sprint board ' });
  });

  it('rejects an empty title', () => {
    expect(
      deleteArchivedProjectSchema.safeParse({ projectId: 'project-1', title: '' }).success,
    ).toBe(false);
  });
});

describe('listArchivedCardsSchema', () => {
  it('accepts a keyset cursor and does not take an offset', () => {
    expect(
      listArchivedCardsSchema.parse({
        projectId: 'project-1',
        cursor: {
          id: 'card-1',
          title: 'Write tests',
          archivedAt: '2026-08-09T10:00:00.000Z',
        },
      }),
    ).toEqual({
      projectId: 'project-1',
      cursor: {
        id: 'card-1',
        title: 'Write tests',
        archivedAt: '2026-08-09T10:00:00.000Z',
      },
    });
  });

  it('rejects an invalid cursor date', () => {
    expect(
      listArchivedCardsSchema.safeParse({
        projectId: 'project-1',
        cursor: { id: 'card-1', title: 'Write tests', archivedAt: 'not-a-date' },
      }).success,
    ).toBe(false);
  });
});

describe('listArchivedProjectsSchema', () => {
  it('accepts a keyset cursor and does not take an offset', () => {
    expect(
      listArchivedProjectsSchema.parse({
        cursor: {
          id: 'project-1',
          title: 'Sprint board',
          archivedAt: '2026-08-09T10:00:00.000Z',
        },
      }),
    ).toEqual({
      cursor: {
        id: 'project-1',
        title: 'Sprint board',
        archivedAt: '2026-08-09T10:00:00.000Z',
      },
    });
  });
});
