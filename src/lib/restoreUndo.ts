import { randomBytes } from 'node:crypto';

export const RESTORE_UNDO_TTL_MS = 5 * 60 * 1000;

type UndoTokenDelegate = {
  deleteMany: (args: { where: { expiresAt: { lte: Date } } }) => Promise<unknown>;
};

export function newRestoreUndoTokenId(): string {
  return randomBytes(32).toString('hex');
}

export function restoreUndoExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + RESTORE_UNDO_TTL_MS);
}

export async function deleteExpiredRestoreUndoTokens(
  db: { restoreUndoToken: UndoTokenDelegate },
  now = new Date(),
): Promise<void> {
  await db.restoreUndoToken.deleteMany({ where: { expiresAt: { lte: now } } });
}
