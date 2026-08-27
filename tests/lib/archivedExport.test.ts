// tests/lib/archivedExport.test.ts
//
// Tests for archived-task CSV and JSON builders.
//
// Tested:
// - CSV quotes fields that contain commas
// - JSON includes comments, subtasks, and archive metadata
// - Filename slugifies the project title
//
// What is covered:
// - Happy path, quoting, filename
//
// Run with: pnpm test:run tests/lib/archivedExport.test.ts
//
// SEE: src/lib/archivedExport.ts

import { describe, it, expect } from 'vitest';

import type { ArchivedTask } from '@/lib/archived';
import { archivedExportFilename, archivedTasksCsv, archivedTasksJson } from '@/lib/archivedExport';

const card: ArchivedTask = {
  id: 'card-1',
  title: 'Sidebar, variants',
  code: 'SB-1',
  description: 'Line one\nline two',
  archivedAt: new Date('2026-08-09T10:00:00.000Z'),
  archivedBy: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
  column: { id: 'col-1', title: 'In review' },
  label: { id: 'label-1', name: 'Design', tone: 'blue' },
  assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
  subtasks: [{ id: 's1', text: 'Sketch', done: true, order: 1 }],
  comments: [
    {
      id: 'c1',
      body: 'Keep the icon set.',
      createdAt: new Date('2026-08-08T10:00:00.000Z'),
      author: { id: 'user-grace', name: 'Grace Hopper', username: 'grace' },
    },
  ],
};

describe('archived export', () => {
  it('quotes CSV cells that contain commas or newlines', () => {
    const csv = archivedTasksCsv([card]);
    expect(csv.split('\n')[0]).toBe(
      'code,title,label,column,subtasksDone,subtasksTotal,commentCount,assignees,archivedAt,archivedBy,description',
    );
    expect(csv).toContain('"Sidebar, variants"');
    expect(csv).toContain('"Line one\nline two"');
    expect(csv).toContain('2026-08-09T10:00:00.000Z');
  });

  it('includes comments and subtasks in JSON', () => {
    const json = JSON.parse(
      archivedTasksJson([card], { id: 'proj-1', title: 'Sprint board' }, new Date('2026-08-26')),
    );
    expect(json.project).toEqual({ id: 'proj-1', title: 'Sprint board' });
    expect(json.tasks[0].subtasks).toHaveLength(1);
    expect(json.tasks[0].comments[0].body).toBe('Keep the icon set.');
    expect(json.tasks[0].archivedBy.username).toBe('ada');
  });

  it('slugifies the filename', () => {
    expect(archivedExportFilename('Sprint board', 'csv')).toBe('sprint-board-archived-tasks.csv');
    expect(archivedExportFilename('  ', 'json')).toBe('archived-tasks.json');
  });
});
