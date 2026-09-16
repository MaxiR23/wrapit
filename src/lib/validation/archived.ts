import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';
import { pageCursorSchema } from '@/lib/validation/pagination';

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

const projectIdsSchema = z
  .array(idSchema)
  .min(1)
  .max(MAX_ARCHIVED_BATCH)
  .transform(uniqueIds)
  .refine((ids) => ids.length >= 1 && ids.length <= MAX_ARCHIVED_BATCH);

export const archiveProjectSchema = z.object({
  projectId: idSchema,
});

export const restoreArchivedProjectsSchema = z.object({
  projectIds: projectIdsSchema,
});

export const rearchiveArchivedProjectsSchema = z.object({
  token: idSchema,
});

export const deleteArchivedProjectSchema = z.object({
  projectId: idSchema,
  title: z.string().min(1),
});

export const listArchivedCardsSchema = z.object({
  projectId: idSchema,
  query: z.string().max(200).optional(),
  range: z.enum(['all', '7', '30', 'old']).optional(),
  sort: z.enum(['date', 'name']).optional(),
  cursor: pageCursorSchema.optional(),
});

export const listArchivedProjectsSchema = z.object({
  query: z.string().max(200).optional(),
  range: z.enum(['all', '7', '30', 'old']).optional(),
  sort: z.enum(['date', 'name']).optional(),
  cursor: pageCursorSchema.optional(),
});

export const archivedCardDetailSchema = z.object({
  cardId: idSchema,
});

export const archivedCardsDetailSchema = z.object({
  projectId: idSchema,
  cardIds: cardIdsSchema,
});
