// Messages shared by more than one component.

/**
 * Shown for any failure that has no recognized code. Deliberately says nothing
 * about what happened: an unexpected error can carry server internals such as a
 * database host or a constraint name, so `error.message` is never rendered.
 */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Shown for every non-invitable target (unknown username, self, already a
 * member, pending invitation). Deliberately the same string in every branch
 * so the response cannot reveal whether the username exists.
 */
export const CANT_INVITE_USER_MESSAGE = "Can't invite this user";

/** Shown when an admin tries to remove the project's last OWNER membership. */
export const LAST_OWNER_MESSAGE = 'Cannot remove the last owner';

/** Shown when the OWNER tries to leave; they must transfer first. */
export const OWNER_MUST_TRANSFER_MESSAGE = 'Transfer ownership before leaving.';

/** Confirm copy before handing the project to another member. */
export const TRANSFER_OWNERSHIP_DESCRIPTION =
  'This hands over the project. You will become an admin.';

/** Confirm copy before a non-owner leaves. */
export const LEAVE_PROJECT_DESCRIPTION =
  'You will lose access. Your cards stay, unassigned from you.';

/** Completing a card when the project has no columns to resolve as Done. */
export const NO_DONE_COLUMN_MESSAGE = 'This project has no Done column.';

/** Returning a card to pending when every column is the Done column. */
export const NO_OPEN_COLUMN_MESSAGE = 'This project has no open column.';

/** Restoring an archived card whose stored column is gone. */
export const MISSING_COLUMN_MESSAGE =
  'The original column no longer exists, so this task cannot be restored.';

/** Batch restore when any selected card's stored column is gone. Nothing is written. */
export const MISSING_COLUMN_BATCH_MESSAGE =
  "A selected task's original column no longer exists, so nothing was restored.";
