import { prisma } from '@/lib/prisma';

export type ViewMode = 'grid' | 'list';

export type UserPreferences = {
  viewMode: ViewMode;
};

export const DEFAULT_VIEW_MODE: ViewMode = 'grid';

/** Maps a Prisma ViewMode (or anything else) to the UI value. Unknown → grid. */
export function parseViewMode(value: unknown): ViewMode {
  return value === 'LIST' ? 'list' : DEFAULT_VIEW_MODE;
}

export function toPrismaViewMode(viewMode: ViewMode): 'GRID' | 'LIST' {
  return viewMode === 'list' ? 'LIST' : 'GRID';
}

export function preferencesFromRow(row: { viewMode: unknown } | null): UserPreferences {
  return { viewMode: parseViewMode(row?.viewMode) };
}

/** Stored preferences for the user, or GRID defaults when no row exists yet. */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const row = await prisma.userPreferences.findUnique({ where: { userId } });
  return preferencesFromRow(row);
}
