// tests/lib/archived.test.ts
//
// Tests for loading, filtering, and copy for a project's archived tasks.
//
// Tested:
// - Returns archived cards with label, column, subtasks, comments, assignees
// - Omits live cards and cards on another project
// - Null archivedBy omits the by-line
// - Search matches title or label; date range ANDs with search
// - Sort by archive date (newest first) or name
// - Slice of 50 reports remaining
//
// What is covered:
// - Query isolation, assembly, filters, sort, volume slice, copy
//
// Run with: pnpm test:run tests/lib/archived.test.ts
//
// SEE: src/lib/archived.ts, src/lib/archivedQuery.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { getArchivedCardsForUser } = await import('@/lib/archivedQuery');
const {
  ARCHIVED_PAGE_SIZE,
  archivedAgeDays,
  archivedByLine,
  archivedCountLabel,
  archivedEmptyCopy,
  archivedTaskDetailLine,
  filterArchivedTasks,
  matchesArchivedSearch,
  sliceArchivedTasks,
} = await import('@/lib/archived');

const now = new Date('2026-08-26T12:00:00.000Z');

describe('getArchivedCardsForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns archived cards with label, column, subtasks, comments, and assignees', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    await db.user.create({
      data: { id: 'user-grace', name: 'Grace Hopper', username: 'grace' },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const label = await db.label.create({
      data: { name: 'Design', tone: 'blue', order: 0, projectId: project.id },
    });
    const archivedAt = new Date('2026-08-09T10:00:00.000Z');
    const card = await db.card.create({
      data: {
        title: 'Sidebar variants',
        code: 'SB-1',
        order: 1,
        columnId: todo.id,
        labelId: label.id,
        archivedAt,
        archivedById: 'user-ada',
      },
    });
    await db.cardAssignee.create({ data: { cardId: card.id, userId: 'user-grace' } });
    await db.subtask.create({
      data: { text: 'Sketch', done: true, order: 1, cardId: card.id },
    });
    await db.subtask.create({
      data: { text: 'Review', done: false, order: 2, cardId: card.id },
    });
    await db.comment.create({
      data: { body: 'Keep the icon set.', cardId: card.id, authorId: 'user-grace' },
    });
    await db.card.create({
      data: { title: 'Live card', code: 'SB-2', order: 2, columnId: todo.id },
    });

    const other = await seedAccessibleProject(db, {
      title: 'Other board',
      userId: 'user-other',
    });
    const otherCol = await db.column.create({
      data: { title: 'To do', order: 1, projectId: other.id },
    });
    await db.card.create({
      data: {
        title: 'Foreign archived',
        code: 'OT-1',
        order: 1,
        columnId: otherCol.id,
        archivedAt,
      },
    });

    const result = await getArchivedCardsForUser(project.id, 'user-ada');

    expect(result?.title).toBe('Sprint board');
    expect(result?.cards.map((card) => card.title)).toEqual(['Sidebar variants']);
    const loaded = result?.cards[0];
    expect(loaded?.column).toEqual({ id: todo.id, title: 'To do' });
    expect(loaded?.label).toEqual({ id: label.id, name: 'Design', tone: 'blue' });
    expect(loaded?.archivedBy).toEqual({
      id: 'user-ada',
      name: 'Ada Lovelace',
      username: 'ada',
    });
    expect(loaded?.assignees).toEqual([
      { id: 'user-grace', name: 'Grace Hopper', username: 'grace' },
    ]);
    expect(loaded?.subtasks.map((subtask) => subtask.text)).toEqual(['Sketch', 'Review']);
    expect(loaded?.comments[0]?.body).toBe('Keep the icon set.');
    expect(loaded?.comments[0]?.author.username).toBe('grace');
  });

  it('returns null for a non-member', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });

    expect(await getArchivedCardsForUser(project.id, 'user-other')).toBeNull();
  });

  it('renders without a by-line when archivedBy is missing', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    await db.card.create({
      data: {
        title: 'Legacy',
        code: 'SB-1',
        order: 1,
        columnId: todo.id,
        archivedAt: new Date('2026-08-01'),
      },
    });

    const result = await getArchivedCardsForUser(project.id, 'user-ada');
    const card = result?.cards[0];
    expect(card?.archivedBy).toBeNull();
    expect(archivedByLine(card!)).toBeNull();
  });
});

describe('filterArchivedTasks', () => {
  const design = {
    id: 't1',
    title: 'Sidebar variants',
    code: 'SB-1',
    description: null,
    archivedAt: new Date('2026-08-20T00:00:00.000Z'),
    archivedBy: null,
    column: { id: 'col-1', title: 'To do' },
    label: { id: 'l1', name: 'Design', tone: 'blue' as const },
    assignees: [],
    subtasks: [],
    comments: [],
  };
  const bug = {
    ...design,
    id: 't2',
    title: 'Safari drag',
    archivedAt: new Date('2026-07-01T00:00:00.000Z'),
    label: { id: 'l2', name: 'Bug', tone: 'red' as const },
  };

  it('matches title or label case-insensitively', () => {
    expect(matchesArchivedSearch(design, 'SIDE')).toBe(true);
    expect(matchesArchivedSearch(design, 'design')).toBe(true);
    expect(matchesArchivedSearch(design, 'bug')).toBe(false);
  });

  it('combines search and date range with AND and sorts', () => {
    const cards = [design, bug];
    expect(
      filterArchivedTasks(cards, { query: '', range: 'all', sort: 'date', now }).map(
        (card) => card.id,
      ),
    ).toEqual(['t1', 't2']);
    expect(
      filterArchivedTasks(cards, { query: '', range: 'all', sort: 'name', now }).map(
        (card) => card.id,
      ),
    ).toEqual(['t2', 't1']);
    expect(
      filterArchivedTasks(cards, { query: 'design', range: '30', sort: 'date', now }).map(
        (card) => card.id,
      ),
    ).toEqual(['t1']);
    expect(
      filterArchivedTasks(cards, { query: 'design', range: 'old', sort: 'date', now }),
    ).toEqual([]);
  });
});

describe('archived helpers', () => {
  it('counts age in whole days', () => {
    expect(archivedAgeDays(new Date('2026-08-19T12:00:00.000Z'), now)).toBe(7);
  });

  it('labels counts and empty copy in English', () => {
    expect(archivedCountLabel(1)).toBe('1 archived task');
    expect(archivedCountLabel(3)).toBe('3 archived tasks');
    expect(archivedEmptyCopy('Sprint board')).toEqual({
      title: 'No archived tasks in Sprint board',
      body: 'Archive a card from the board and you will find it here.',
    });
  });

  it('builds the name-cell detail line from shared counters', () => {
    const card = {
      id: 't1',
      title: 'Sidebar',
      code: 'SB-1',
      description: null,
      archivedAt: now,
      archivedBy: null,
      column: { id: 'c1', title: 'To do' },
      label: null,
      assignees: [],
      subtasks: [
        { id: 's1', text: 'A', done: true, order: 1 },
        { id: 's2', text: 'B', done: true, order: 2 },
        { id: 's3', text: 'C', done: false, order: 3 },
      ],
      comments: Array.from({ length: 6 }, (_, index) => ({
        id: `c${index}`,
        body: 'note',
        createdAt: now,
        author: { id: 'u1', name: 'Ada', username: 'ada' },
      })),
    };
    expect(archivedTaskDetailLine(card)).toBe('2/3 subtasks · 6 comments');
  });

  it('slices to the page size and reports remaining', () => {
    const items = Array.from({ length: ARCHIVED_PAGE_SIZE + 3 }, (_, index) => index);
    expect(sliceArchivedTasks(items, ARCHIVED_PAGE_SIZE)).toEqual({
      shown: items.slice(0, ARCHIVED_PAGE_SIZE),
      remaining: 3,
    });
  });
});
