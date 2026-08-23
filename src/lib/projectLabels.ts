import { accessibleByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import { DEFAULT_PROJECT_LABELS, labelFromRow, type LabelView } from '@/lib/labels';

type LabelRow = {
  id?: unknown;
  name?: unknown;
  tone?: unknown;
  order?: unknown;
};

type LabelSeedTx = {
  label: {
    findMany: (args: {
      where: { projectId: string };
      orderBy?: { order: 'asc' | 'desc' };
      take?: number;
    }) => Promise<LabelRow[]>;
    createMany: (args: {
      data: Array<{ name: string; tone: string; order: number; projectId: string }>;
    }) => Promise<{ count: number }>;
  };
};

type ProjectLabelDb = {
  label: LabelSeedTx['label'];
  project: {
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<Record<string, unknown> | null>;
  };
  $transaction: <T>(fn: (tx: LabelSeedTx) => Promise<T>) => Promise<T>;
};

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === 'P2002') return true;
  if ('message' in error && String(error.message).toLowerCase().includes('unique')) return true;
  return false;
}

async function loadExisting(tx: LabelSeedTx, projectId: string): Promise<LabelView[] | null> {
  const rows = await tx.label.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  });
  if (rows.length === 0) return null;
  return rows.map(labelFromRow);
}

/**
 * Returns stored labels, inserting the six defaults when the project has none.
 * Call inside a project lock when used from a write.
 */
export async function seedProjectLabelsIfEmpty(
  tx: LabelSeedTx,
  projectId: string,
): Promise<LabelView[]> {
  const existing = await loadExisting(tx, projectId);
  if (existing) return existing;

  await tx.label.createMany({
    data: DEFAULT_PROJECT_LABELS.map((label) => ({ ...label, projectId })),
  });

  const created = await tx.label.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  });
  return created.map(labelFromRow);
}

/** Stored labels for a member's project, seeding defaults when none exist yet. */
export async function getProjectLabelsForUser(
  projectId: string,
  userId: string,
): Promise<LabelView[] | null> {
  const db = prisma as unknown as ProjectLabelDb;
  const project = await db.project.findFirst({
    where: { id: projectId, ...accessibleByUser(userId) },
  });
  if (!project) return null;

  try {
    return await db.$transaction((tx) => seedProjectLabelsIfEmpty(tx, projectId));
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return db.$transaction((tx) => loadExisting(tx, projectId));
  }
}
