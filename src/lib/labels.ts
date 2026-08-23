import { LABEL_TONES, parseLabelTone, type LabelTone } from '@/lib/labelTones';

export const MAX_PROJECT_LABELS = 20;

export const MAX_PROJECT_LABELS_MESSAGE = 'You can have at most 20 labels';

export const LAST_LABEL_MESSAGE = 'Cannot delete the last label';

export const DEFAULT_PROJECT_LABELS = [
  { name: 'Design', tone: 'blue', order: 0 },
  { name: 'Content', tone: 'green', order: 1 },
  { name: 'Infra', tone: 'amber', order: 2 },
  { name: 'Bug', tone: 'red', order: 3 },
  { name: 'Product', tone: 'violet', order: 4 },
  { name: 'Internal', tone: 'gray', order: 5 },
] as const satisfies ReadonlyArray<{
  name: string;
  tone: LabelTone;
  order: number;
}>;

export type LabelView = {
  id: string;
  name: string;
  tone: LabelTone;
  order: number;
};

export type CardLabelView = {
  id: string;
  name: string;
  tone: LabelTone;
};

type LabelRow = {
  id?: unknown;
  name?: unknown;
  tone?: unknown;
  order?: unknown;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Maps a stored row to the editor view. Unknown tone → first catalog key. */
export function labelFromRow(row: LabelRow): LabelView {
  return {
    id: asString(row.id),
    name: asString(row.name),
    tone: parseLabelTone(row.tone) ?? LABEL_TONES[0],
    order: typeof row.order === 'number' ? row.order : Number(row.order) || 0,
  };
}

/** Pill payload. Unknown or missing tone → null (do not render). */
export function cardLabelFromRow(row: LabelRow | null | undefined): CardLabelView | null {
  if (!row) return null;
  const tone = parseLabelTone(row.tone);
  if (!tone) return null;
  const id = asString(row.id);
  if (!id) return null;
  return { id, name: asString(row.name), tone };
}

export function nextLabelName(count: number): string {
  return `Label ${count + 1}`;
}

/** Keep card pills in sync with the current label list after a rename or delete. */
export function syncCardLabel<T extends { label?: CardLabelView | null }>(
  card: T,
  labels: LabelView[],
): T {
  if (!card.label) return card;
  const current = labels.find((label) => label.id === card.label?.id);
  if (current) {
    const view = cardLabelFromRow(current);
    return view ? { ...card, label: view } : card;
  }
  const fallback = labels[0] ? cardLabelFromRow(labels[0]) : null;
  return { ...card, label: fallback };
}

export function syncCardLabels<T extends { label?: CardLabelView | null }>(
  cardsById: Record<string, T>,
  labels: LabelView[],
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [id, card] of Object.entries(cardsById)) {
    next[id] = syncCardLabel(card, labels);
  }
  return next;
}

export class LastLabelError extends Error {
  constructor() {
    super(LAST_LABEL_MESSAGE);
    this.name = 'LastLabelError';
  }
}

export class MaxLabelsError extends Error {
  constructor() {
    super(MAX_PROJECT_LABELS_MESSAGE);
    this.name = 'MaxLabelsError';
  }
}

type ProjectRowLockTx = {
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

/**
 * Serialize mutations for one project. Call at the start of a delete (and
 * create) transaction so two overlapping last-label deletes cannot each pass
 * the remaining-count guard against the other's still-uncommitted row.
 */
export async function lockProjectRow(tx: ProjectRowLockTx, projectId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
}

/**
 * Throws when the project has no remaining labels. Call AFTER a conditional
 * deleteMany in the same transaction, and only after lockProjectRow.
 */
export async function assertNotLastLabel(
  db: { label: { count: (args: { where: Record<string, unknown> }) => Promise<number> } },
  projectId: string,
): Promise<void> {
  const remaining = await db.label.count({ where: { projectId } });
  if (remaining === 0) {
    throw new LastLabelError();
  }
}
