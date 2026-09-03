import { subtaskProgress, commentCount } from '@/lib/cardCounters';
import type { ArchivedTask } from '@/lib/archived';

export type ArchivedExportFormat = 'csv' | 'json';

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
    const progress = subtaskProgress(card.subtasks);
    lines.push(
      [
        csvCell(card.code),
        csvCell(card.title),
        csvCell(card.label?.name ?? ''),
        csvCell(card.column.title),
        String(progress.done),
        String(progress.total),
        String(commentCount(card.comments)),
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
