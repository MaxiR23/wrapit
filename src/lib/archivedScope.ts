import type { ArchivedProject, ArchivedTask } from '@/lib/archived';
import { archivedCopy } from '@/lib/archivedCopy';

export type ArchivedScopeId = 'tasks' | 'projects' | 'columns';

export const TASKS_SCOPE_ID: ArchivedScopeId = 'tasks';
export const PROJECTS_SCOPE_ID: ArchivedScopeId = 'projects';

export const archivedTasksScope = {
  id: TASKS_SCOPE_ID,
  headers: archivedCopy.headers,
  nameOf: (card: ArchivedTask) => card.title,
  canExport: true,
  canBatchDelete: true,
} as const;

export const archivedProjectsScope = {
  id: PROJECTS_SCOPE_ID,
  headers: archivedCopy.projects.headers,
  nameOf: (project: ArchivedProject) => project.title,
  canExport: false,
  canBatchDelete: false,
} as const;
