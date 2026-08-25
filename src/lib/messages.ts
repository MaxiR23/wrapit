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
