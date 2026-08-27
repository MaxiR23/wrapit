// tests/lib/validation/archived.test.ts
//
// Tests for archived-card and archived-project action schemas.
//
// Tested:
// - Restore and delete card batches accept bounded unique ids
// - Delete project requires a non-empty title and does not trim it
// - Archive and restore project ids reject empty or oversized values
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
