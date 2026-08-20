import { z } from 'zod';

/**
 * Shared bound for database identifiers passed into server actions. Runtime
 * ids are cuid (about 25 chars) or UUID (36); this cap rejects oversized
 * payloads without being format-specific, so later slices can reuse it.
 */
export const MAX_ID_LENGTH = 128;

export const idSchema = z.string().trim().min(1).max(MAX_ID_LENGTH);
