// tests/lib/labels.test.ts
//
// Tests for project label defaults, row mapping, last-label guard, and seed.
//
// Tested:
// - Seeds six defaults on first read and does not insert on a later read
// - Retries the read when a concurrent seed hits the unique order constraint
// - Returns null for a non-member or unknown project
// - Does not seed another project's labels
// - cardLabelFromRow omits unknown tones; labelFromRow falls back to blue
// - nextLabelName uses the current count
// - assertNotLastLabel throws after a delete that emptied the list
//
// What is covered:
// - Seed, existing rows, concurrent unique, membership, mapping, last-label guard
//
// Run with: pnpm test:run tests/lib/labels.test.ts
//
// SEE: src/lib/labels.ts, src/lib/projectLabels.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const {
  DEFAULT_PROJECT_LABELS,
  LastLabelError,
  assertNotLastLabel,
  cardLabelFromRow,
  labelFromRow,
  nextLabelName,
  syncCardLabel,
} = await import('@/lib/labels');
const { getProjectLabelsForUser } = await import('@/lib/projectLabels');

describe('labelFromRow and cardLabelFromRow', () => {
  it('maps a stored row and falls back to blue for an unknown tone', () => {
    expect(labelFromRow({ id: 'l1', name: 'Design', tone: 'violet', order: 4 })).toEqual({
      id: 'l1',
      name: 'Design',
      tone: 'violet',
      order: 4,
    });
    expect(labelFromRow({ id: 'l1', name: 'Odd', tone: 'secret', order: 0 }).tone).toBe('blue');
  });

  it('omits a pill when the stored tone is unknown or the row is missing', () => {
    expect(cardLabelFromRow({ id: 'l1', name: 'Design', tone: 'blue' })).toEqual({
      id: 'l1',
      name: 'Design',
      tone: 'blue',
    });
    expect(cardLabelFromRow({ id: 'l1', name: 'Odd', tone: 'secret' })).toBeNull();
    expect(cardLabelFromRow(null)).toBeNull();
  });

  it('names a new label from the current count', () => {
    expect(nextLabelName(6)).toBe('Label 7');
    expect(nextLabelName(0)).toBe('Label 1');
  });

  it('updates a card pill on rename and reassigns after a delete', () => {
    const labels = [
      { id: 'l0', name: 'Design', tone: 'blue' as const, order: 0 },
      { id: 'l1', name: 'Bug', tone: 'red' as const, order: 1 },
    ];
    const renamed = labels.map((label) =>
      label.id === 'l1' ? { ...label, name: 'Defect' } : label,
    );
    expect(
      syncCardLabel({ id: 'c1', label: { id: 'l1', name: 'Bug', tone: 'red' as const } }, renamed)
        .label,
    ).toEqual({ id: 'l1', name: 'Defect', tone: 'red' });

    const remaining = [labels[0]!];
    expect(
      syncCardLabel({ id: 'c1', label: { id: 'l1', name: 'Bug', tone: 'red' as const } }, remaining)
        .label,
    ).toEqual({ id: 'l0', name: 'Design', tone: 'blue' });
  });
});

describe('getProjectLabelsForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('seeds six defaults in handoff order on first read', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });

    const labels = await getProjectLabelsForUser(project.id, 'user-ada');

    expect(
      labels?.map((label) => ({ name: label.name, tone: label.tone, order: label.order })),
    ).toEqual([...DEFAULT_PROJECT_LABELS]);
    expect(db.label.rows).toHaveLength(6);
  });

  it('returns stored rows without inserting when the project already has labels', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    await db.label.create({
      data: { id: 'custom', projectId: project.id, name: 'Custom', tone: 'cyan', order: 0 },
    });

    const labels = await getProjectLabelsForUser(project.id, 'user-ada');

    expect(labels).toEqual([{ id: 'custom', name: 'Custom', tone: 'cyan', order: 0 }]);
    expect(db.label.rows).toHaveLength(1);
  });

  it('retries the read when a concurrent seed hits the unique order constraint', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: 'user-ada',
    });
    for (const label of DEFAULT_PROJECT_LABELS) {
      await db.label.create({ data: { ...label, projectId: project.id } });
    }
    db.label.findMany.mockResolvedValueOnce([]);
    db.label.createMany.mockRejectedValueOnce(new Error('unique constraint'));

    const labels = await getProjectLabelsForUser(project.id, 'user-ada');

    expect(labels).toHaveLength(6);
    expect(db.label.rows).toHaveLength(6);
  });

  it('returns null for a non-member and does not seed', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    expect(await getProjectLabelsForUser(project.id, 'user-ada')).toBeNull();
    expect(db.label.rows).toHaveLength(0);
  });

  it('does not create labels on another project', async () => {
    const ada = await seedAccessibleProject(db, {
      title: 'Ada board',
      userId: 'user-ada',
    });
    const other = await seedAccessibleProject(db, {
      title: 'Other board',
      userId: 'user-other',
    });
    for (const label of DEFAULT_PROJECT_LABELS) {
      await db.label.create({ data: { ...label, projectId: other.id } });
    }

    const labels = await getProjectLabelsForUser(ada.id, 'user-ada');

    expect(labels).toHaveLength(6);
    expect(db.label.rows.filter((row) => row.projectId === other.id)).toHaveLength(6);
    expect(db.label.rows.filter((row) => row.projectId === ada.id)).toHaveLength(6);
  });
});

describe('assertNotLastLabel', () => {
  beforeEach(() => {
    db.reset();
  });

  it('throws LastLabelError when no labels remain and does not insert', async () => {
    await expect(assertNotLastLabel(db, 'project-1')).rejects.toEqual(expect.any(LastLabelError));
    await expect(assertNotLastLabel(db, 'project-1')).rejects.toThrow(
      'Cannot delete the last label',
    );
    expect(db.label.rows).toHaveLength(0);
  });

  it('does not throw when at least one label remains', async () => {
    await db.label.create({
      data: { projectId: 'project-1', name: 'Design', tone: 'blue', order: 0 },
    });

    await expect(assertNotLastLabel(db, 'project-1')).resolves.toBeUndefined();
  });
});
