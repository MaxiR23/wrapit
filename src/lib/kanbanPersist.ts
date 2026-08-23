import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import {
  findContainer,
  placeCardInColumn,
  type ItemsByColumn,
  type MoveCommit,
} from '@/lib/kanbanItems';

export type PersistJob = MoveCommit;

export type PersistPayload = {
  cardId: string;
  sourceColumnId: string;
  targetColumnId: string;
};

/** Apply pending commits in order onto a persisted baseline. */
export function applyPendingJobs(
  baseline: ItemsByColumn,
  jobs: readonly PersistJob[],
): ItemsByColumn {
  return jobs.reduce(
    (items, job) => placeCardInColumn(items, job.cardId, job.targetColumnId),
    baseline,
  );
}

/** Build the board that should exist after this job lands on `baseline`. */
export function reconcilePersistJob(baseline: ItemsByColumn, job: PersistJob): ItemsByColumn {
  return placeCardInColumn(baseline, job.cardId, job.targetColumnId);
}

/**
 * Payload for moveCard from the persisted baseline: occupancy source is where
 * the card sits before this job, not the snapshot from an older drag.
 */
export function persistPayloadFromBaseline(
  baseline: ItemsByColumn,
  job: PersistJob,
): PersistPayload | null {
  const sourceColumnId = findContainer(baseline, job.cardId);
  if (!sourceColumnId) return null;
  return {
    cardId: job.cardId,
    sourceColumnId,
    targetColumnId: job.targetColumnId,
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
