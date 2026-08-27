// tests/lib/projects.test.ts
//
// Tests for listing projects and loading a single project for a user.
//
// Tested:
// - Returns only projects the user is a member of
// - Includes a project the user is a MEMBER of, not the creator
// - Returns projects newest first
// - Returns an empty list when the user has no memberships
// - Returns the project with columns in order for a member
// - Returns each column with its cards in order
// - Attaches ordered subtasks and comments (with author) on each card
// - Omits archived cards so their subtasks and comments are not loaded
// - Returns null for a non-member or unknown project id
// - Summaries include computed progress, owner avatars, and 0 of 0
// - Recents are at most 4 after membership access filtering, most recent first,
//   and scoped to the user. Inaccessible rows do not consume the cap.
//   Membership-only recents are returned.
//
// What is covered:
// - Happy path, membership isolation, empty list, project detail with cards,
//   subtasks and comments, archived cards omitted, grid summaries, recents
//   membership access filter
//
// Run with: pnpm test:run tests/lib/projects.test.ts
//
// SEE: src/lib/projects.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const {
  listProjectsForUser,
  getProjectForUser,
  listProjectSummariesForUser,
  listRecentProjectsForUser,
  listProjectMembersForUser,
  getArchivedProjectForUser,
} = await import('@/lib/projects');

describe('listProjectsForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns only projects the user is a member of', async () => {
    await seedAccessibleProject(db, {
      title: 'Ada board',
      userId: 'user-ada',
      createdAt: new Date('2026-01-01'),
    });
    await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other', createdAt: new Date('2026-01-02') },
    });

    const projects = await listProjectsForUser('user-ada');

    expect(projects).toHaveLength(1);
    expect(projects[0]?.title).toBe('Ada board');
    expect(projects.every((project) => project.ownerId === 'user-ada')).toBe(true);
  });

  it('includes a project the user is a MEMBER of, not the creator', async () => {
    await seedAccessibleProject(db, {
      title: 'Shared board',
      userId: 'user-ada',
      ownerId: 'user-other',
      role: 'MEMBER',
    });

    const projects = await listProjectsForUser('user-ada');

    expect(projects).toHaveLength(1);
    expect(projects[0]?.title).toBe('Shared board');
    expect(projects[0]?.ownerId).toBe('user-other');
  });

  it('returns projects newest first', async () => {
    await seedAccessibleProject(db, {
      title: 'Older',
      userId: 'user-ada',
      createdAt: new Date('2026-01-01'),
    });
    await seedAccessibleProject(db, {
      title: 'Newer',
      userId: 'user-ada',
      createdAt: new Date('2026-06-01'),
    });

    const projects = await listProjectsForUser('user-ada');

    expect(projects.map((project) => project.title)).toEqual(['Newer', 'Older']);
  });

  it('returns an empty list when the user has no projects', async () => {
    await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    expect(await listProjectsForUser('user-ada')).toEqual([]);
  });
});

describe('getProjectForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns the project with columns in order for a member', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.column.create({
      data: { title: 'Done', order: 2, projectId: project.id },
    });
    await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });

    const result = await getProjectForUser(project.id, 'user-ada');

    expect(result).toEqual(
      expect.objectContaining({
        id: project.id,
        title: 'Sprint board',
        ownerId: 'user-ada',
      }),
    );
    expect(result?.columns.map((column) => column.title)).toEqual(['To do', 'Done']);
    expect(result?.columns.every((column) => column.cards.length === 0)).toBe(true);
  });

  it('returns each column with its cards in order', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const done = await db.column.create({
      data: { title: 'Done', order: 2, projectId: project.id },
    });
    await db.card.create({
      data: { title: 'Second', order: 2, columnId: todo.id },
    });
    await db.card.create({
      data: { title: 'First', order: 1, columnId: todo.id },
    });
    await db.card.create({
      data: { title: 'Finished', order: 1, columnId: done.id },
    });

    const result = await getProjectForUser(project.id, 'user-ada');

    expect(result?.columns[0]?.cards.map((card) => card.title)).toEqual(['First', 'Second']);
    expect(result?.columns[1]?.cards.map((card) => card.title)).toEqual(['Finished']);
    expect(result?.columns[0]?.cards.every((card) => card.assignees.length === 0)).toBe(true);
  });

  it('returns assignees on each card', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'First', order: 1, columnId: todo.id },
    });
    await db.cardAssignee.create({
      data: { cardId: card.id, userId: 'user-ada' },
    });

    const result = await getProjectForUser(project.id, 'user-ada');

    expect(result?.columns[0]?.cards[0]?.assignees).toEqual([
      { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    ]);
  });

  it('attaches ordered subtasks and comments with author on each card', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'First', order: 1, columnId: todo.id },
    });
    await db.subtask.create({
      data: { text: 'Later', done: false, order: 2, cardId: card.id },
    });
    await db.subtask.create({
      data: { text: 'First step', done: true, order: 1, cardId: card.id },
    });
    await db.comment.create({
      data: {
        body: 'Second note',
        cardId: card.id,
        authorId: 'user-ada',
        createdAt: new Date('2026-08-02'),
      },
    });
    await db.comment.create({
      data: {
        body: 'First note',
        cardId: card.id,
        authorId: 'user-ada',
        createdAt: new Date('2026-08-01'),
      },
    });

    const result = await getProjectForUser(project.id, 'user-ada');
    const loaded = result?.columns[0]?.cards[0];

    expect(loaded?.subtasks.map((subtask) => subtask.text)).toEqual(['First step', 'Later']);
    expect(loaded?.comments.map((comment) => comment.body)).toEqual(['First note', 'Second note']);
    expect(loaded?.comments[0]?.author).toEqual({
      id: 'user-ada',
      name: 'Ada Lovelace',
      username: 'ada',
    });
  });

  it('omits archived cards from the board payload', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    await db.card.create({
      data: { title: 'Open', order: 1, columnId: todo.id },
    });
    await db.card.create({
      data: { title: 'Archived', order: 2, columnId: todo.id, archivedAt: new Date('2026-08-01') },
    });

    const result = await getProjectForUser(project.id, 'user-ada');

    expect(result?.columns[0]?.cards.map((card) => card.title)).toEqual(['Open']);
  });

  it('does not load subtasks or comments for archived cards', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const open = await db.card.create({
      data: { title: 'Open', order: 1, columnId: todo.id },
    });
    const archived = await db.card.create({
      data: { title: 'Archived', order: 2, columnId: todo.id, archivedAt: new Date('2026-08-01') },
    });
    await db.subtask.create({
      data: { text: 'Open step', done: false, order: 1, cardId: open.id },
    });
    await db.subtask.create({
      data: { text: 'Archived step', done: false, order: 1, cardId: archived.id },
    });
    await db.comment.create({
      data: { body: 'Open note', cardId: open.id, authorId: 'user-ada' },
    });
    await db.comment.create({
      data: { body: 'Archived note', cardId: archived.id, authorId: 'user-ada' },
    });

    db.subtask.findMany.mockClear();
    db.comment.findMany.mockClear();

    const result = await getProjectForUser(project.id, 'user-ada');

    expect(result?.columns[0]?.cards.map((card) => card.title)).toEqual(['Open']);
    expect(result?.columns[0]?.cards[0]?.subtasks.map((subtask) => subtask.text)).toEqual([
      'Open step',
    ]);
    expect(result?.columns[0]?.cards[0]?.comments.map((comment) => comment.body)).toEqual([
      'Open note',
    ]);
    expect(db.subtask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardId: { in: [open.id] } } }),
    );
    expect(db.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardId: { in: [open.id] } } }),
    );
  });

  it('returns null for a non-member', async () => {
    const project = await db.project.create({
      data: { title: 'Ada board', ownerId: 'user-ada' },
    });

    expect(await getProjectForUser(project.id, 'user-other')).toBeNull();
  });

  it('returns null for an unknown project id', async () => {
    expect(await getProjectForUser('missing-project', 'user-ada')).toBeNull();
  });
});

describe('listProjectSummariesForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns computed progress, members, and status for accessible projects', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
      status: 'IN_PROGRESS',
      createdAt: new Date('2026-01-01'),
    });
    const todo = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const done = await db.column.create({
      data: { title: 'Done', order: 2, projectId: project.id },
    });
    await db.card.create({
      data: { title: 'Open', order: 1, columnId: todo.id, updatedAt: new Date('2026-02-01') },
    });
    await db.card.create({
      data: { title: 'Finished', order: 1, columnId: done.id, updatedAt: new Date('2026-03-01') },
    });
    await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, starred: false },
    });

    const summaries = await listProjectSummariesForUser('user-ada');

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toEqual(
      expect.objectContaining({
        id: project.id,
        title: 'Sprint board',
        status: 'IN_PROGRESS',
        statusLabel: 'In progress',
        taskCount: 2,
        doneCount: 1,
        percent: 50,
        starred: false,
        canAdminister: true,
      }),
    );
    expect(summaries[0]?.members.map((member) => member.username)).toEqual(['ada', 'maxi']);
  });

  it('returns 0 of 0 and 0% when the project has no cards', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    await seedAccessibleProject(db, {
      title: 'Empty board',
      userId: 'user-ada',
      status: 'NEW',
    });

    const summaries = await listProjectSummariesForUser('user-ada');

    expect(summaries[0]).toEqual(
      expect.objectContaining({
        title: 'Empty board',
        taskCount: 0,
        doneCount: 0,
        percent: 0,
        statusLabel: 'New',
      }),
    );
    expect(summaries[0]?.members).toEqual([
      { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    ]);
  });

  it('does not include projects the user is not a member of', async () => {
    await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    expect(await listProjectSummariesForUser('user-ada')).toEqual([]);
  });
});

describe('listRecentProjectsForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  async function ownedRecent(title: string, openedAt: string, ownerId = 'user-ada') {
    const project = await seedAccessibleProject(db, {
      title,
      userId: 'user-ada',
      ownerId,
    });
    await db.recentProject.create({
      data: { userId: 'user-ada', projectId: project.id, openedAt: new Date(openedAt) },
    });
    return project;
  }

  it('returns at most 4 recents for the user, most recent first', async () => {
    await ownedRecent('Sprint board', '2026-01-01');
    const second = await ownedRecent('Second', '2026-02-01');
    const third = await ownedRecent('Third', '2026-03-01');
    const fourth = await ownedRecent('Fourth', '2026-04-01');
    const fifth = await ownedRecent('Fifth', '2026-05-01');

    const recents = await listRecentProjectsForUser('user-ada');

    expect(recents).toHaveLength(4);
    expect(recents.map((recent) => recent.projectId)).toEqual([
      fifth.id,
      fourth.id,
      third.id,
      second.id,
    ]);
  });

  it('does not include another user recents', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.recentProject.create({
      data: { userId: 'user-other', projectId: project.id, openedAt: new Date('2026-06-01') },
    });

    expect(await listRecentProjectsForUser('user-ada')).toEqual([]);
  });

  it('fills the cap with older accessible recents when a newer row is inaccessible', async () => {
    const first = await ownedRecent('First', '2026-01-01');
    const second = await ownedRecent('Second', '2026-02-01');
    const third = await ownedRecent('Third', '2026-03-01');
    const fourth = await ownedRecent('Fourth', '2026-04-01');
    const fifth = await ownedRecent('Fifth', '2026-05-01');
    const gone = await db.project.create({
      data: { title: 'Gone board', ownerId: 'user-other' },
    });
    await db.recentProject.create({
      data: {
        userId: 'user-ada',
        projectId: gone.id,
        openedAt: new Date('2026-06-01'),
      },
    });

    const recents = await listRecentProjectsForUser('user-ada');

    expect(recents).toHaveLength(4);
    expect(recents.map((recent) => recent.projectId)).toEqual([
      fifth.id,
      fourth.id,
      third.id,
      second.id,
    ]);
    expect(recents.map((recent) => recent.projectId)).not.toContain(gone.id);
    expect(recents.map((recent) => recent.projectId)).not.toContain(first.id);
  });

  it('never returns inaccessible recents', async () => {
    const owned = await ownedRecent('Sprint board', '2026-01-01');
    const gone = await db.project.create({
      data: { title: 'Gone board', ownerId: 'user-other' },
    });
    await db.recentProject.create({
      data: {
        userId: 'user-ada',
        projectId: gone.id,
        openedAt: new Date('2026-06-01'),
      },
    });

    const recents = await listRecentProjectsForUser('user-ada');

    expect(recents.map((recent) => recent.projectId)).toEqual([owned.id]);
  });

  it('returns a recent for a project the user only has membership on', async () => {
    const memberProject = await seedAccessibleProject(db, {
      title: 'Shared board',
      userId: 'user-ada',
      ownerId: 'user-other',
      role: 'MEMBER',
    });
    await db.recentProject.create({
      data: {
        userId: 'user-ada',
        projectId: memberProject.id,
        openedAt: new Date('2026-06-01'),
      },
    });

    const recents = await listRecentProjectsForUser('user-ada');

    expect(recents.map((recent) => recent.projectId)).toEqual([memberProject.id]);
  });
});

describe('listProjectMembersForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('lists memberships for an accessible project, owner first', async () => {
    await db.user.create({
      data: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    await db.user.create({
      data: { id: 'user-max', name: 'Maxi', username: 'maxi' },
    });
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.membership.create({
      data: { userId: 'user-max', projectId: project.id, role: 'MEMBER', starred: false },
    });

    const members = await listProjectMembersForUser(project.id, 'user-ada');

    expect(members).toEqual([
      expect.objectContaining({
        userId: 'user-ada',
        name: 'Ada Lovelace',
        role: 'OWNER',
        access: 'EDIT',
      }),
      expect.objectContaining({
        userId: 'user-max',
        name: 'Maxi',
        role: 'MEMBER',
        access: 'EDIT',
      }),
    ]);
  });

  it('returns null when the user is not a member', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-other',
    });

    expect(await listProjectMembersForUser(project.id, 'user-ada')).toBeNull();
  });
});

describe('archived project leak', () => {
  beforeEach(() => {
    db.reset();
  });

  async function seedArchivedMembership() {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.project.update({
      where: { id: project.id },
      data: { archivedAt: new Date('2026-08-09T10:00:00.000Z'), archivedById: 'user-ada' },
    });
    await db.recentProject.create({
      data: { userId: 'user-ada', projectId: project.id, openedAt: new Date() },
    });
    return project;
  }

  it('omits archived projects from live lists and board reads', async () => {
    const project = await seedArchivedMembership();

    expect(await listProjectsForUser('user-ada')).toEqual([]);
    expect(await listProjectSummariesForUser('user-ada')).toEqual([]);
    expect(await listRecentProjectsForUser('user-ada')).toEqual([]);
    expect(await getProjectForUser(project.id, 'user-ada')).toBeNull();
  });

  it('returns the archived project for a member bookmark redirect', async () => {
    const project = await seedArchivedMembership();

    expect(await getArchivedProjectForUser(project.id, 'user-ada')).toEqual(
      expect.objectContaining({ id: project.id }),
    );
    expect(await getArchivedProjectForUser(project.id, 'user-other')).toBeNull();
  });
});
