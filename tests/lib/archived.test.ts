// tests/lib/archived.test.ts
//
// Tests for loading, filtering, and copy for a project's archived tasks.
//
// Tested:
// - Returns archived cards with label, column, progress counts, comment count, assignees
// - Selects face fields and groups subtasks; omits description and subtask text
// - Omits live cards and cards on another project
// - Null archivedBy omits the by-line
// - Search matches title or label; date range ANDs with search
// - Sort by archive date (newest first) or name, with id as the name-sort tie-break
// - A later page continues from the server nextCursor
// - A row inserted ahead of the cursor does not change hasMore for the next page
// - Slice of 50 reports remaining
// - Selected archived cards load description, comment bodies, authors, and subtask text
// - Sets canAdminister from the viewer's membership role
// - Rollback inserts restored rows in the active sort order
//
// What is covered:
// - Query isolation, assembly, filters, sort, keyset page, insert-ahead hasMore,
//   volume slice, copy,
//   deferred detail, viewer canAdminister from membership role, ordered insert
//
// Run with: pnpm test:run tests/lib/archived.test.ts
//
// SEE: src/lib/archived.ts, src/lib/archivedQuery.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { getArchivedCardsForUser, getArchivedCardsDetailForUser } =
  await import('@/lib/archivedQuery');
const {
  ARCHIVED_PAGE_SIZE,
  archivedAgeDays,
  archivedByLine,
  archivedCountLabel,
  archivedEmptyCopy,
  archivedTaskDetailLine,
  filterArchivedTasks,
  insertArchivedTasks,
  matchesArchivedSearch,
  sliceArchivedTasks,
} = await import('@/lib/archived');

const now = new Date('2026-08-26T12:00:00.000Z');

describe('getArchivedCardsForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns archived cards with face fields, progress counts, and comment count', async () => {
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
        description: 'Cover the board',
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

    db.card.findMany.mockClear();
    db.subtask.findMany.mockClear();
    db.subtask.groupBy.mockClear();

    const result = await getArchivedCardsForUser(project.id, 'user-ada');

    expect(db.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          title: true,
          code: true,
          labelId: true,
          columnId: true,
          archivedAt: true,
          archivedById: true,
        },
      }),
    );
    const cardSelect = db.card.findMany.mock.calls[0]?.[0]?.select as Record<string, unknown>;
    expect(cardSelect).not.toHaveProperty('description');
    expect(db.subtask.findMany).not.toHaveBeenCalled();
    expect(db.subtask.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['cardId', 'done'],
        where: { cardId: { in: [card.id] } },
        _count: { _all: true },
      }),
    );

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
    expect(loaded?.subtaskDone).toBe(1);
    expect(loaded?.subtaskTotal).toBe(2);
    expect(loaded).not.toHaveProperty('subtasks');
    expect(loaded?.commentCount).toBe(1);
    expect(loaded?.comments).toEqual([]);
    expect(loaded?.description).toBeNull();
    expect(result?.totalCount).toBe(1);
    expect(result?.canAdminister).toBe(true);
  });

  it('returns null when the project itself is archived', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.project.update({
      where: { id: project.id },
      data: { archivedAt: new Date('2026-08-09T10:00:00.000Z') },
    });

    expect(await getArchivedCardsForUser(project.id, 'user-ada')).toBeNull();
  });

  it('returns null for a non-member', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });

    expect(await getArchivedCardsForUser(project.id, 'user-other')).toBeNull();
  });

  it('sets canAdminister from OWNER and ADMIN membership, not MEMBER', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const ownerProject = await seedAccessibleProject(db, {
      title: 'Owner board',
      userId: 'user-ada',
    });
    const adminProject = await seedAccessibleProject(db, {
      title: 'Admin board',
      userId: 'user-ada',
      role: 'ADMIN',
    });
    const memberProject = await seedAccessibleProject(db, {
      title: 'Member board',
      userId: 'user-ada',
      role: 'MEMBER',
    });

    expect((await getArchivedCardsForUser(ownerProject.id, 'user-ada'))?.canAdminister).toBe(true);
    expect((await getArchivedCardsForUser(adminProject.id, 'user-ada'))?.canAdminister).toBe(true);
    expect((await getArchivedCardsForUser(memberProject.id, 'user-ada'))?.canAdminister).toBe(
      false,
    );
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

  it('paginates in the database with a matching count', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    for (let index = 0; index < 3; index += 1) {
      await db.card.create({
        data: {
          title: `Card ${index}`,
          code: `SB-${index}`,
          order: index,
          columnId: todo.id,
          archivedAt: new Date(`2026-08-0${index + 1}T10:00:00.000Z`),
        },
      });
    }

    const page = await getArchivedCardsForUser(project.id, 'user-ada', { take: 2 });

    expect(page?.totalCount).toBe(3);
    expect(page?.cards).toHaveLength(2);
    expect(page?.cards.map((card) => card.title)).toEqual(['Card 2', 'Card 1']);
    expect(page?.hasMore).toBe(true);
    expect(typeof page?.nextCursor).toBe('string');

    const rest = await getArchivedCardsForUser(project.id, 'user-ada', {
      take: 2,
      cursor: page?.nextCursor ?? undefined,
    });
    expect(rest?.totalCount).toBe(3);
    expect(rest?.cards.map((card) => card.title)).toEqual(['Card 0']);
    expect(rest?.hasMore).toBe(false);
    expect(rest?.nextCursor).toBeNull();
  });

  it('does not change hasMore for the next page when a row is inserted ahead of the cursor', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    for (let index = 0; index < 3; index += 1) {
      await db.card.create({
        data: {
          title: `Card ${index}`,
          code: `SB-${index}`,
          order: index,
          columnId: todo.id,
          archivedAt: new Date(`2026-08-0${index + 1}T10:00:00.000Z`),
        },
      });
    }

    const page = await getArchivedCardsForUser(project.id, 'user-ada', { take: 2 });
    expect(page?.hasMore).toBe(true);

    await db.card.create({
      data: {
        title: 'Newest',
        code: 'SB-9',
        order: 9,
        columnId: todo.id,
        archivedAt: new Date('2026-08-09T10:00:00.000Z'),
      },
    });

    const rest = await getArchivedCardsForUser(project.id, 'user-ada', {
      take: 2,
      cursor: page?.nextCursor ?? undefined,
    });
    expect(rest?.totalCount).toBe(4);
    expect(rest?.cards.map((card) => card.title)).toEqual(['Card 0']);
    expect(rest?.hasMore).toBe(false);
    expect(rest?.nextCursor).toBeNull();
  });

  it('applies title search in the same query', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    await db.card.create({
      data: {
        title: 'Sidebar variants',
        code: 'SB-1',
        order: 1,
        columnId: todo.id,
        archivedAt: new Date('2026-08-09T10:00:00.000Z'),
      },
    });
    await db.card.create({
      data: {
        title: 'Unrelated',
        code: 'SB-2',
        order: 2,
        columnId: todo.id,
        archivedAt: new Date('2026-08-08T10:00:00.000Z'),
      },
    });

    const page = await getArchivedCardsForUser(project.id, 'user-ada', { query: 'sidebar' });

    expect(page?.totalCount).toBe(1);
    expect(page?.cards.map((card) => card.title)).toEqual(['Sidebar variants']);
  });
});

describe('getArchivedCardsDetailForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns description, comment bodies, authors, and subtask text for selected archived cards', async () => {
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
    const card = await db.card.create({
      data: {
        title: 'Sidebar variants',
        description: 'Cover the board',
        order: 1,
        columnId: todo.id,
        archivedAt: new Date('2026-08-09T10:00:00.000Z'),
      },
    });
    await db.subtask.create({
      data: { text: 'Sketch the nav', done: true, order: 1, cardId: card.id },
    });
    await db.comment.create({
      data: {
        body: 'Keep the icon set.',
        cardId: card.id,
        authorId: 'user-grace',
        createdAt: new Date('2026-08-08T10:00:00.000Z'),
      },
    });

    const details = await getArchivedCardsDetailForUser(project.id, [card.id], 'user-ada');

    expect(details?.[card.id]?.description).toBe('Cover the board');
    expect(details?.[card.id]?.subtasks.map((subtask) => subtask.text)).toEqual(['Sketch the nav']);
    expect(details?.[card.id]?.comments[0]?.body).toBe('Keep the icon set.');
    expect(details?.[card.id]?.comments[0]?.author).toEqual({
      id: 'user-grace',
      name: 'Grace Hopper',
      username: 'grace',
    });
  });

  it('returns null for a non-member', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: {
        title: 'Sidebar variants',
        order: 1,
        columnId: todo.id,
        archivedAt: new Date('2026-08-09T10:00:00.000Z'),
      },
    });

    expect(await getArchivedCardsDetailForUser(project.id, [card.id], 'user-other')).toBeNull();
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

  it('breaks name ties by id the same way the paged list does', () => {
    const sameTitle = {
      ...design,
      title: 'Sidebar variants',
    };
    const earlierId = { ...sameTitle, id: 't0', archivedAt: new Date('2026-08-01T00:00:00.000Z') };
    const laterId = { ...sameTitle, id: 't9', archivedAt: new Date('2026-08-21T00:00:00.000Z') };
    expect(
      filterArchivedTasks([laterId, earlierId], { query: '', range: 'all', sort: 'name', now }).map(
        (card) => card.id,
      ),
    ).toEqual(['t0', 't9']);
  });

  it('inserts restored rows using the active date comparator', () => {
    const newest = {
      ...design,
      id: 'n',
      title: 'Newest',
      archivedAt: new Date('2026-08-21T00:00:00.000Z'),
    };
    const oldest = bug;
    const middle = design;
    expect(insertArchivedTasks([newest, oldest], [middle], 'date').map((card) => card.id)).toEqual([
      'n',
      't1',
      't2',
    ]);
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
        editedAt: null,
        author: { id: 'u1', name: 'Ada', username: 'ada' },
      })),
    };
    expect(archivedTaskDetailLine(card)).toBe('2/3 subtasks · 6 comments');
    expect(
      archivedTaskDetailLine({
        ...card,
        subtasks: undefined,
        comments: [],
        commentCount: 6,
        subtaskDone: 2,
        subtaskTotal: 3,
      }),
    ).toBe('2/3 subtasks · 6 comments');
  });

  it('slices to the page size and reports remaining', () => {
    const items = Array.from({ length: ARCHIVED_PAGE_SIZE + 3 }, (_, index) => index);
    expect(sliceArchivedTasks(items, ARCHIVED_PAGE_SIZE)).toEqual({
      shown: items.slice(0, ARCHIVED_PAGE_SIZE),
      remaining: 3,
    });
  });
});
