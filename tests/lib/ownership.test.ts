// tests/lib/ownership.test.ts
//
// Tests for column, card, and label access helpers.
//
// Tested:
// - Resolves a column on a project the user is a member of
// - Resolves a column when the user is a MEMBER, not the creator
// - Returns null for a column the user is not a member of
// - Resolves a card through column and project membership
// - Returns null for a card on a project the user is not a member of
// - Resolves a label on a project the user is a member of
// - Returns null for a label the user is not a member of
//
// What is covered:
// - Membership chain for columns, cards, and labels
//
// Run with: pnpm test:run tests/lib/ownership.test.ts
//
// SEE: src/lib/ownership.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { getColumnForUser, getCardForUser, getLabelForUser } = await import('@/lib/ownership');

describe('getColumnForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('resolves a column that belongs to a project the user can access', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });

    const result = await getColumnForUser(column.id, 'user-ada');

    expect(result).toEqual({
      column: expect.objectContaining({ id: column.id, title: 'To do' }),
      project: expect.objectContaining({ id: project.id, ownerId: 'user-ada' }),
    });
  });

  it('resolves a column when the user is a MEMBER, not the creator', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Shared board',
      userId: 'user-ada',
      ownerId: 'user-other',
      role: 'MEMBER',
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });

    const result = await getColumnForUser(column.id, 'user-ada');

    expect(result?.column.id).toBe(column.id);
    expect(result?.project.id).toBe(project.id);
  });

  it('returns null for a column on a project the user is not a member of', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });

    expect(await getColumnForUser(column.id, 'user-ada')).toBeNull();
  });

  it('returns null for an unknown column id', async () => {
    expect(await getColumnForUser('missing-column', 'user-ada')).toBeNull();
  });
});

describe('getCardForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('resolves a card through column and project membership', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Write tests', order: 1, columnId: column.id },
    });

    const result = await getCardForUser(card.id, 'user-ada');

    expect(result).toEqual({
      card: expect.objectContaining({ id: card.id, title: 'Write tests' }),
      column: expect.objectContaining({ id: column.id }),
      project: expect.objectContaining({ id: project.id, ownerId: 'user-ada' }),
    });
  });

  it('returns null for a card on a project the user is not a member of', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const column = await db.column.create({
      data: { title: 'To do', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Stolen', order: 1, columnId: column.id },
    });

    expect(await getCardForUser(card.id, 'user-ada')).toBeNull();
  });

  it('returns null for an unknown card id', async () => {
    expect(await getCardForUser('missing-card', 'user-ada')).toBeNull();
  });
});

describe('getLabelForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('resolves a label that belongs to a project the user can access', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const label = await db.label.create({
      data: { name: 'Design', tone: 'blue', order: 0, projectId: project.id },
    });

    const result = await getLabelForUser(label.id, 'user-ada');

    expect(result).toEqual({
      label: expect.objectContaining({ id: label.id, name: 'Design' }),
      project: expect.objectContaining({ id: project.id, ownerId: 'user-ada' }),
    });
  });

  it('resolves a label when the user is a MEMBER, not the creator', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Shared board',
      userId: 'user-ada',
      ownerId: 'user-other',
      role: 'MEMBER',
    });
    const label = await db.label.create({
      data: { name: 'Bug', tone: 'red', order: 3, projectId: project.id },
    });

    const result = await getLabelForUser(label.id, 'user-ada');

    expect(result?.label.id).toBe(label.id);
    expect(result?.project.id).toBe(project.id);
  });

  it('returns null for a label on a project the user is not a member of', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });
    const label = await db.label.create({
      data: { name: 'Design', tone: 'blue', order: 0, projectId: project.id },
    });

    expect(await getLabelForUser(label.id, 'user-ada')).toBeNull();
  });

  it('returns null for an unknown label id', async () => {
    expect(await getLabelForUser('missing-label', 'user-ada')).toBeNull();
  });
});
