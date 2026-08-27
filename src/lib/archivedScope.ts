import type { ArchivedTask } from '@/lib/archived';
import { archivedCopy } from '@/lib/archivedCopy';

export type ArchivedScopeId = 'tasks' | 'projects' | 'columns';

export const TASKS_SCOPE_ID: ArchivedScopeId = 'tasks';

export const archivedTasksScope = {
  id: TASKS_SCOPE_ID,
  headers: archivedCopy.headers,
  nameOf: (card: ArchivedTask) => card.title,
} as const;
