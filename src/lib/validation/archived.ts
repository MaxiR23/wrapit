import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';

export const MAX_ARCHIVED_BATCH = 200;

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

const cardIdsSchema = z
  .array(idSchema)
  .min(1)
  .max(MAX_ARCHIVED_BATCH)
  .transform(uniqueIds)
  .refine((ids) => ids.length >= 1 && ids.length <= MAX_ARCHIVED_BATCH);

export const restoreArchivedCardsSchema = z.object({
  projectId: idSchema,
  cardIds: cardIdsSchema,
});

export const deleteArchivedCardsSchema = z.object({
  projectId: idSchema,
  cardIds: cardIdsSchema,
});

export const rearchiveArchivedCardsSchema = z.object({
  token: idSchema,
});

export const restoreUndoCardSnapshotSchema = z.object({
  id: idSchema,
  archivedAt: z.coerce.date(),
  archivedById: idSchema.nullable(),
});

export const restoreUndoCardsSchema = z
  .array(restoreUndoCardSnapshotSchema)
  .min(1)
  .max(MAX_ARCHIVED_BATCH);
