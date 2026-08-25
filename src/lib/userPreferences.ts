import { DEFAULT_BOARD_VISIBILITY, type BoardVisibility } from '@/lib/boardView';
import { prisma } from '@/lib/prisma';

export type ViewMode = 'grid' | 'list';

export type UserPreferences = {
  viewMode: ViewMode;
  boardVisibility: BoardVisibility;
};

export const DEFAULT_VIEW_MODE: ViewMode = 'grid';

/** Maps a Prisma ViewMode (or anything else) to the UI value. Unknown → grid. */
export function parseViewMode(value: unknown): ViewMode {
  return value === 'LIST' ? 'list' : DEFAULT_VIEW_MODE;
}

export function toPrismaViewMode(viewMode: ViewMode): 'GRID' | 'LIST' {
  return viewMode === 'list' ? 'LIST' : 'GRID';
}

/** Missing or non-false values show the field. Only an explicit false hides it. */
export function parseBoardVisibilityFlag(value: unknown): boolean {
  return value !== false;
}

export function boardVisibilityFromRow(
  row: {
    showCardLabel?: unknown;
    showCardCode?: unknown;
    showCardComments?: unknown;
    showCardSubtasks?: unknown;
    showCardDueDate?: unknown;
    showCardAssignees?: unknown;
  } | null,
): BoardVisibility {
  if (!row) return { ...DEFAULT_BOARD_VISIBILITY };
  return {
    label: parseBoardVisibilityFlag(row.showCardLabel),
    code: parseBoardVisibilityFlag(row.showCardCode),
    comments: parseBoardVisibilityFlag(row.showCardComments),
    subtasks: parseBoardVisibilityFlag(row.showCardSubtasks),
    dueDate: parseBoardVisibilityFlag(row.showCardDueDate),
    assignees: parseBoardVisibilityFlag(row.showCardAssignees),
  };
}

export function toPrismaBoardVisibility(visibility: BoardVisibility) {
  return {
    showCardLabel: visibility.label,
    showCardCode: visibility.code,
    showCardComments: visibility.comments,
    showCardSubtasks: visibility.subtasks,
    showCardDueDate: visibility.dueDate,
    showCardAssignees: visibility.assignees,
  };
}

export function preferencesFromRow(
  row: {
    viewMode: unknown;
    showCardLabel?: unknown;
    showCardCode?: unknown;
    showCardComments?: unknown;
    showCardSubtasks?: unknown;
    showCardDueDate?: unknown;
    showCardAssignees?: unknown;
  } | null,
): UserPreferences {
  return {
    viewMode: parseViewMode(row?.viewMode),
    boardVisibility: boardVisibilityFromRow(row),
  };
}

/** Stored preferences for the user, or GRID / all-visible defaults when no row exists yet. */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const row = await prisma.userPreferences.findUnique({ where: { userId } });
  return preferencesFromRow(row);
}
