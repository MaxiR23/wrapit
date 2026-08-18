// tests/lib/validation/project.test.ts
//
// Tests for the project field validation.
//
// Tested:
// - Reports no errors for a non-empty title
// - Reports an error when the title is empty
// - Reports an error when the title is only whitespace
// - Allows a missing or empty description
// - Accepts NEW, IN_PROGRESS, and PAUSED as status
// - Rejects DONE and unknown status values
// - Allows omitting featured; rejects a non-boolean featured value
// - Allows omitting columns; accepts a valid explicit column list
// - Rejects an empty column list, more than 8 columns, and empty or
//   whitespace column titles
//
// What is covered:
// - Happy path, invalid title, optional description/status/featured/columns
//
// Run with: pnpm test:run tests/lib/validation/project.test.ts
//
// SEE: src/lib/validation/project.ts

import { describe, it, expect } from 'vitest';

import { validateProject } from '@/lib/validation/project';

describe('validateProject', () => {
  it('reports no errors for a non-empty title', () => {
    expect(validateProject({ title: 'Sprint board' })).toEqual({});
  });

  it('reports an error when the title is empty', () => {
    expect(validateProject({ title: '' }).title).toBe('Title is required');
  });

  it('reports an error when the title is only whitespace', () => {
    expect(validateProject({ title: '   ' }).title).toBe('Title is required');
  });

  it('allows a missing description', () => {
    expect(validateProject({ title: 'Sprint board' })).toEqual({});
  });

  it('allows an empty description', () => {
    expect(validateProject({ title: 'Sprint board', description: '' })).toEqual({});
  });

  it('allows a whitespace-only description', () => {
    expect(validateProject({ title: 'Sprint board', description: '   ' })).toEqual({});
  });

  it('accepts NEW, IN_PROGRESS, and PAUSED as status', () => {
    expect(validateProject({ title: 'Sprint board', status: 'NEW' })).toEqual({});
    expect(validateProject({ title: 'Sprint board', status: 'IN_PROGRESS' })).toEqual({});
    expect(validateProject({ title: 'Sprint board', status: 'PAUSED' })).toEqual({});
  });

  it('rejects DONE as status', () => {
    expect(
      validateProject({ title: 'Sprint board', status: 'DONE' } as { title: string }).status,
    ).toBe('Status must be New, In progress, or Paused');
  });

  it('rejects an unknown status value', () => {
    expect(
      validateProject({ title: 'Sprint board', status: 'GARBAGE' } as { title: string }).status,
    ).toBe('Status must be New, In progress, or Paused');
  });

  it('allows omitting featured', () => {
    expect(validateProject({ title: 'Sprint board' })).toEqual({});
  });

  it('allows featured true or false', () => {
    expect(validateProject({ title: 'Sprint board', featured: true })).toEqual({});
    expect(validateProject({ title: 'Sprint board', featured: false })).toEqual({});
  });

  it('rejects a non-boolean featured value', () => {
    expect(
      validateProject({ title: 'Sprint board', featured: 'yes' } as { title: string }).featured,
    ).toBeTruthy();
  });

  it('allows omitting columns', () => {
    expect(validateProject({ title: 'Sprint board' })).toEqual({});
  });

  it('allows a valid explicit column list', () => {
    expect(
      validateProject({
        title: 'Sprint board',
        columns: [
          { title: 'Backlog', order: 2 },
          { title: 'Done', order: 9 },
        ],
      }),
    ).toEqual({});
  });

  it('rejects an empty column list', () => {
    expect(validateProject({ title: 'Sprint board', columns: [] }).columns).toBe(
      'At least one column is required',
    );
  });

  it('rejects more than 8 columns', () => {
    const columns = Array.from({ length: 9 }, (_, order) => ({
      title: `Column ${order + 1}`,
      order,
    }));

    expect(validateProject({ title: 'Sprint board', columns }).columns).toBe(
      'A project can have at most 8 columns',
    );
  });

  it('rejects an empty column title', () => {
    expect(
      validateProject({
        title: 'Sprint board',
        columns: [{ title: '', order: 0 }],
      }).columns,
    ).toBe('Title is required');
  });

  it('rejects a whitespace-only column title', () => {
    expect(
      validateProject({
        title: 'Sprint board',
        columns: [{ title: '   ', order: 0 }],
      }).columns,
    ).toBe('Title is required');
  });
});
