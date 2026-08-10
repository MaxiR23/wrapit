import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import {
  neighborsAt,
  placeCardBetween,
  type ItemsByColumn,
  type MoveCommit,
} from '@/lib/kanbanItems';

export type PersistJob = MoveCommit;

/** Apply pending commits in order onto a persisted baseline. */
export function applyPendingJobs(
  baseline: ItemsByColumn,
  jobs: readonly PersistJob[],
): ItemsByColumn {
  return jobs.reduce(
    (items, job) =>
      placeCardBetween(items, job.cardId, job.targetColumnId, job.beforeCardId, job.afterCardId),
    baseline,
  );
}

/** Build the board that should exist after this job lands on `baseline`. */
export function reconcilePersistJob(baseline: ItemsByColumn, job: PersistJob): ItemsByColumn {
  return placeCardBetween(
    baseline,
    job.cardId,
    job.targetColumnId,
    job.beforeCardId,
    job.afterCardId,
  );
}

/** Neighbors to send to moveCard after reconciling onto the persisted baseline. */
export function persistPayloadFromReconciled(
  reconciled: ItemsByColumn,
  job: PersistJob,
): MoveCommit {
  const destIds = reconciled[job.targetColumnId] ?? [];
  const index = destIds.indexOf(job.cardId);
  const neighbors = neighborsAt(destIds, index);
  return {
    cardId: job.cardId,
    targetColumnId: job.targetColumnId,
    beforeCardId: neighbors.beforeCardId,
    afterCardId: neighbors.afterCardId,
  };
}

export type PersistFinishResult = {
  persisted: ItemsByColumn;
  display: ItemsByColumn;
  error: string | null;
};

/**
 * After a queued persist finishes: update baseline only on success, then rebuild
 * display as baseline + remaining pending jobs (so a failure does not wipe them).
 */
export function reducePersistFinish(args: {
  persisted: ItemsByColumn;
  finishedJob: PersistJob;
  remainingJobs: readonly PersistJob[];
  failed: boolean;
}): PersistFinishResult {
  const persisted = args.failed
    ? args.persisted
    : reconcilePersistJob(args.persisted, args.finishedJob);

  const display =
    args.remainingJobs.length === 0 ? persisted : applyPendingJobs(persisted, args.remainingJobs);

  return {
    persisted,
    display,
    error: args.failed ? GENERIC_ERROR_MESSAGE : null,
  };
}

/** True when a moveCard return value means failure (not a thrown rejection). */
export function isMoveCardErrorResult(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as { error: unknown }).error === 'string'
  );
}
