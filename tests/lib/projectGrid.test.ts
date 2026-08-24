// tests/lib/projectGrid.test.ts
//
// Tests for project grid view-model helpers: progress, members, labels, time,
// and client-side title search.
//
// Tested:
// - Counts cards in a Done column as done
// - Falls back to the last column by order when no Done column exists
// - Renders N of M cards done, N/M done, and the empty-board copy
// - Rounds the percentage
// - Always includes the owner among members
// - Pluralizes the project count label
// - Pluralizes the list-view task count label
// - Formats the updated label from a known now
// - Filters projects by title: empty query, case-insensitive includes, no match, trim
// - Recents map to summaries in the given order and skip ids without a payload
// - Optimistic starred reducer returns a new map and does not mutate
//
// What is covered:
// - Done-title vs last-column fallback, empty project, rounding, avatars, copy,
//   client-side title filter
//
// Run with: pnpm test:run tests/lib/projectGrid.test.ts
//
// SEE: src/lib/projectGrid.ts

import { describe, it, expect } from 'vitest';

import {
  applyOptimisticStarred,
  filterProjectsByTitle,
  filterRecentProjects,
  formatUpdatedAt,
  latestActivityAt,
  projectCountLabel,
  projectMembers,
  projectProgress,
  projectStatusBarClass,
  projectStatusLabel,
  taskCountLabel,
  taskProgressLabel,
  boardProgressEmptyLabel,
  boardProgressLabel,
  boardProgressShortLabel,
  type ProjectSummary,
} from '@/lib/projectGrid';

const sprintBoard: ProjectSummary = {
  id: 'project-1',
  title: 'Sprint board',
  status: 'IN_PROGRESS',
  statusLabel: 'In progress',
  taskCount: 24,
  doneCount: 11,
  percent: 46,
  updatedLabel: 'Updated 2 hours ago',
  starred: false,
  members: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
};

const emptyBoard: ProjectSummary = {
  ...sprintBoard,
  id: 'project-2',
  title: 'Empty board',
  status: 'NEW',
  statusLabel: 'New',
  taskCount: 0,
  doneCount: 0,
  percent: 0,
};

describe('projectProgress', () => {
  it('counts cards in a Done column as done', () => {
    expect(
      projectProgress([
        { title: 'To do', order: 1, cards: [{}, {}] },
        { title: 'Done', order: 2, cards: [{}] },
      ]),
    ).toEqual({ taskCount: 3, doneCount: 1, percent: 33 });
  });

  it('matches Done case-insensitively even when it is not last', () => {
    expect(
      projectProgress([
        { title: 'done', order: 1, cards: [{}, {}] },
        { title: 'Review', order: 2, cards: [{}] },
      ]),
    ).toEqual({ taskCount: 3, doneCount: 2, percent: 67 });
  });

  it('falls back to the last column by order when no Done column exists', () => {
    expect(
      projectProgress([
        { title: 'To do', order: 1, cards: [{}, {}, {}] },
        { title: 'In progress', order: 2, cards: [{}] },
        { title: 'Listo', order: 3, cards: [{}, {}] },
      ]),
    ).toEqual({ taskCount: 6, doneCount: 2, percent: 33 });
  });

  it('returns 0 of 0 and 0% when there are no cards', () => {
    expect(projectProgress([])).toEqual({ taskCount: 0, doneCount: 0, percent: 0 });
    expect(projectProgress([{ title: 'To do', order: 1, cards: [] }])).toEqual({
      taskCount: 0,
      doneCount: 0,
      percent: 0,
    });
  });

  it('rounds the percentage', () => {
    expect(
      projectProgress([
        { title: 'To do', order: 1, cards: Array.from({ length: 13 }, () => ({})) },
        { title: 'Done', order: 2, cards: Array.from({ length: 11 }, () => ({})) },
      ]),
    ).toEqual({ taskCount: 24, doneCount: 11, percent: 46 });
  });
});

describe('taskProgressLabel', () => {
  it('renders N of M tasks', () => {
    expect(taskProgressLabel(0, 0)).toBe('0 of 0 tasks');
    expect(taskProgressLabel(11, 24)).toBe('11 of 24 tasks');
  });
});

describe('boardProgressLabel', () => {
  it('renders N of M cards done', () => {
    expect(boardProgressLabel(0, 0)).toBe('0 of 0 cards done');
    expect(boardProgressLabel(6, 9)).toBe('6 of 9 cards done');
  });
});

describe('boardProgressShortLabel', () => {
  it('renders N/M done', () => {
    expect(boardProgressShortLabel(0, 0)).toBe('0/0 done');
    expect(boardProgressShortLabel(6, 9)).toBe('6/9 done');
  });
});

describe('boardProgressEmptyLabel', () => {
  it('tells the user they can create the first card in any column', () => {
    expect(boardProgressEmptyLabel()).toBe(
      'There are no cards yet. You can create the first one in any column.',
    );
  });
});

describe('taskCountLabel', () => {
  it('pluralizes the task count', () => {
    expect(taskCountLabel(0)).toBe('0 tasks');
    expect(taskCountLabel(1)).toBe('1 task');
    expect(taskCountLabel(24)).toBe('24 tasks');
  });
});

describe('projectCountLabel', () => {
  it('pluralizes the project count', () => {
    expect(projectCountLabel(0)).toBe('0 projects');
    expect(projectCountLabel(1)).toBe('1 project');
    expect(projectCountLabel(11)).toBe('11 projects');
  });
});

describe('projectMembers', () => {
  it('includes the owner even without a membership row', () => {
    expect(
      projectMembers({
        owner: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
        memberships: [],
      }),
    ).toEqual([{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }]);
  });

  it('appends other members and does not duplicate the owner', () => {
    expect(
      projectMembers({
        owner: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
        memberships: [
          { user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' } },
          { user: { id: 'user-max', name: 'Maxi', username: 'maxi' } },
        ],
      }),
    ).toEqual([
      { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
      { id: 'user-max', name: 'Maxi', username: 'maxi' },
    ]);
  });
});

describe('latestActivityAt', () => {
  it('uses the project createdAt when there are no cards', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    expect(latestActivityAt(createdAt, [])).toEqual(createdAt);
  });

  it('uses the most recent card updatedAt when cards exist', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const older = new Date('2026-02-01T00:00:00Z');
    const newer = new Date('2026-03-01T00:00:00Z');
    expect(latestActivityAt(createdAt, [{ updatedAt: newer }, { updatedAt: older }])).toEqual(
      newer,
    );
  });
});

describe('formatUpdatedAt', () => {
  const now = new Date('2026-08-13T22:00:00Z');

  it('says just now for updates under a minute old', () => {
    expect(formatUpdatedAt(new Date('2026-08-13T21:59:30Z'), now)).toBe('Updated just now');
  });

  it('uses a relative English phrase', () => {
    expect(formatUpdatedAt(new Date('2026-08-13T20:00:00Z'), now)).toBe('Updated 2 hours ago');
    expect(formatUpdatedAt(new Date('2026-08-12T22:00:00Z'), now)).toBe('Updated yesterday');
  });
});

describe('filterProjectsByTitle', () => {
  const projects = [sprintBoard, emptyBoard];

  it('returns all projects when the query is empty or only whitespace', () => {
    expect(filterProjectsByTitle(projects, '')).toEqual(projects);
    expect(filterProjectsByTitle(projects, '   ')).toEqual(projects);
  });

  it('matches titles case-insensitively by includes', () => {
    expect(filterProjectsByTitle(projects, 'SPRINT')).toEqual([sprintBoard]);
    expect(filterProjectsByTitle(projects, 'board')).toEqual(projects);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterProjectsByTitle(projects, 'kanban')).toEqual([]);
  });

  it('trims the query before matching', () => {
    expect(filterProjectsByTitle(projects, '  empty  ')).toEqual([emptyBoard]);
  });
});

describe('filterRecentProjects', () => {
  it('keeps recents in the given order and skips ids without a summary', () => {
    expect(
      filterRecentProjects(
        [
          { projectId: emptyBoard.id },
          { projectId: 'gone-project' },
          { projectId: sprintBoard.id },
        ],
        [sprintBoard, emptyBoard],
      ),
    ).toEqual([emptyBoard, sprintBoard]);
  });

  it('returns an empty list when none of the recents have a summary', () => {
    expect(filterRecentProjects([{ projectId: 'gone-project' }], [sprintBoard])).toEqual([]);
  });
});

describe('applyOptimisticStarred', () => {
  it('returns a new map with the given starred value and does not mutate', () => {
    const current = { 'project-1': false, 'project-2': true };

    const next = applyOptimisticStarred(current, { projectId: 'project-1', starred: true });

    expect(next).toEqual({ 'project-1': true, 'project-2': true });
    expect(next).not.toBe(current);
    expect(current).toEqual({ 'project-1': false, 'project-2': true });
  });
});

describe('project status', () => {
  it('maps enum values to English labels and bar classes', () => {
    expect(projectStatusLabel('NEW')).toBe('New');
    expect(projectStatusLabel('IN_PROGRESS')).toBe('In progress');
    expect(projectStatusLabel('PAUSED')).toBe('Paused');
    expect(projectStatusLabel('DONE')).toBe('Done');
    expect(projectStatusBarClass('IN_PROGRESS')).toBe('bg-status-in-progress');
    expect(projectStatusBarClass('DONE')).toBe('bg-status-done');
    expect(projectStatusBarClass('PAUSED')).toBe('bg-status-paused');
    expect(projectStatusBarClass('NEW')).toBe('bg-status-new');
  });
});
