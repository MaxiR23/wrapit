// tests/lib/accountActivity.test.ts
//
// Tests for account Activity tab project memberships and assigned counts.
//
// Tested:
// - Returns the user's projects with role and assigned-card counts
// - Ignores archived cards
// - Does not count assignments on projects the user left
// - Loads assignments in one query, not one per project
// - Returns an empty list when the user has no memberships
// - Formats Owner/Admin/Member with a singular or plural card count
//
// What is covered:
// - Happy path, archived exclusion, membership isolation, query count, empty, copy
//
// Run with: pnpm test:run tests/lib/accountActivity.test.ts
//
// SEE: src/lib/accountActivity.ts

import { describe, it, expect, beforeEach } from 'vitest';

import { accountProjectRoleLine, listAccountProjectsForUser } from '@/lib/accountActivity';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();

async function seedAssignedCard(
  projectId: string,
  input: { userId: string; archivedAt?: Date | null },
) {
  const column = await db.column.create({
    data: { title: 'To do', order: 0, projectId },
  });
  const card = await db.card.create({
    data: {
      title: 'Write tests',
      columnId: column.id,
      archivedAt: input.archivedAt ?? null,
    },
  });
  await db.cardAssignee.create({
    data: { cardId: card.id, userId: input.userId },
  });
  return card;
}

describe('listAccountProjectsForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns memberships with assigned counts and ignores archived cards', async () => {
    const sprint = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
      description: 'Ship the grid.',
      createdAt: new Date('2026-08-02'),
    });
    const support = await seedAccessibleProject(db, {
      title: 'Support',
      userId: 'user-ada',
      role: 'MEMBER',
      createdAt: new Date('2026-08-01'),
    });
    await seedAssignedCard(sprint.id, { userId: 'user-ada' });
    await seedAssignedCard(sprint.id, { userId: 'user-ada' });
    await seedAssignedCard(sprint.id, {
      userId: 'user-ada',
      archivedAt: new Date('2026-08-20'),
    });
    await seedAssignedCard(support.id, { userId: 'user-ada' });

    const projects = await listAccountProjectsForUser(db, 'user-ada');

    expect(projects).toEqual([
      {
        id: sprint.id,
        title: 'Sprint board',
        description: 'Ship the grid.',
        role: 'OWNER',
        assignedCount: 2,
      },
      {
        id: support.id,
        title: 'Support',
        description: null,
        role: 'MEMBER',
        assignedCount: 1,
      },
    ]);
  });

  it('does not count assignments on a project the user left', async () => {
    const mine = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    const left = await db.project.create({
      data: { title: 'Old board', ownerId: 'user-other' },
    });
    await seedAssignedCard(mine.id, { userId: 'user-ada' });
    await seedAssignedCard(left.id, { userId: 'user-ada' });

    const projects = await listAccountProjectsForUser(db, 'user-ada');

    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual(expect.objectContaining({ id: mine.id, assignedCount: 1 }));
  });

  it('loads assignments once for every project', async () => {
    await seedAccessibleProject(db, { title: 'One', userId: 'user-ada' });
    await seedAccessibleProject(db, { title: 'Two', userId: 'user-ada' });
    db.cardAssignee.findMany.mockClear();

    await listAccountProjectsForUser(db, 'user-ada');

    expect(db.cardAssignee.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list when the user has no memberships', async () => {
    await db.project.create({ data: { title: 'Other', ownerId: 'user-other' } });

    expect(await listAccountProjectsForUser(db, 'user-ada')).toEqual([]);
  });
});

describe('accountProjectRoleLine', () => {
  it('formats the role and a singular or plural card count', () => {
    expect(accountProjectRoleLine('OWNER', 6)).toBe('Owner · 6 cards');
    expect(accountProjectRoleLine('ADMIN', 1)).toBe('Admin · 1 card');
    expect(accountProjectRoleLine('MEMBER', 0)).toBe('Member · 0 cards');
  });
});
