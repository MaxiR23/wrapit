import { faceSubtaskProgress, commentCount } from '@/lib/cardCounters';
import type { ArchivedTask } from '@/lib/archived';
import { MAX_ARCHIVED_BATCH } from '@/lib/validation/archived';

export type ArchivedExportFormat = 'csv' | 'json';

/** Split ids so each getArchivedCardsDetail call stays within MAX_ARCHIVED_BATCH. */
export function archivedExportIdBatches(ids: string[], size = MAX_ARCHIVED_BATCH): string[][] {
  if (ids.length === 0 || size < 1) return [];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    batches.push(ids.slice(i, i + size));
  }
  return batches;
}

export async function loadArchivedExportDetails<T>(
  cardIds: string[],
  loadBatch: (batch: string[]) => Promise<{ data: Record<string, T> } | { error: string }>,
  batchSize = MAX_ARCHIVED_BATCH,
): Promise<{ data: Record<string, T> } | { error: string }> {
  const data: Record<string, T> = {};
  for (const batch of archivedExportIdBatches(cardIds, batchSize)) {
    const result = await loadBatch(batch);
    if ('error' in result) return result;
    Object.assign(data, result.data);
  }
  return { data };
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function archivedExportFilename(projectTitle: string, format: ArchivedExportFormat): string {
  const slug = projectTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return `archived-tasks.${format}`;
  return `${slug}-archived-tasks.${format}`;
}

export function archivedTasksCsv(cards: ArchivedTask[]): string {
  const header = [
    'code',
    'title',
    'label',
    'column',
    'subtasksDone',
    'subtasksTotal',
    'commentCount',
    'assignees',
    'archivedAt',
    'archivedBy',
    'description',
  ];
  const lines = [header.join(',')];
  for (const card of cards) {
    const progress = faceSubtaskProgress(card);
    lines.push(
      [
        csvCell(card.code),
        csvCell(card.title),
        csvCell(card.label?.name ?? ''),
        csvCell(card.column.title),
        String(progress.done),
        String(progress.total),
        String(card.commentCount ?? commentCount(card.comments)),
        csvCell(card.assignees.map((person) => person.name || person.username).join('; ')),
        csvCell(card.archivedAt.toISOString()),
        csvCell(card.archivedBy?.name ?? ''),
        csvCell(card.description ?? ''),
      ].join(','),
    );
  }
  return lines.join('\n');
}

export function archivedTasksJson(
  cards: ArchivedTask[],
  project: { id: string; title: string },
  exportedAt = new Date(),
): string {
  return `${JSON.stringify(
    {
      exportedAt: exportedAt.toISOString(),
      project,
      tasks: cards.map((card) => ({
        id: card.id,
        code: card.code,
        title: card.title,
        description: card.description,
        label: card.label,
        column: card.column,
        subtasks: card.subtasks,
        comments: card.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          editedAt: comment.editedAt ? comment.editedAt.toISOString() : null,
          author: comment.author,
        })),
        assignees: card.assignees,
        archivedAt: card.archivedAt.toISOString(),
        archivedBy: card.archivedBy,
      })),
    },
    null,
    2,
  )}\n`;
}
