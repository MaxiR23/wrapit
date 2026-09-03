// Messages shared by more than one component.

/**
 * Shown for any failure that has no recognized code. Deliberately says nothing
 * about what happened: an unexpected error can carry server internals such as a
 * database host or a constraint name, so `error.message` is never rendered.
 */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/** Shown when sign-in succeeds on credentials but the email is not verified. */
export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Verify your email before signing in. Check your inbox, or request a new link.';

/**
 * Shown after every successful resend request, whether or not the address has
 * an unverified account. Deliberately the same string so the response cannot
 * reveal whether the email is registered.
 */
export const VERIFICATION_RESEND_CONFIRMATION =
  'If that email is registered and still needs verifying, a new link is on its way.';

/** Shown when the verification JWT is missing, expired, or invalid. */
export const VERIFICATION_LINK_INVALID_MESSAGE =
  'This verification link is invalid or has expired.';

/**
 * Shown when a still-valid verification link is opened after the email is
 * already verified. Better Auth verification tokens are JWTs, so a reused
 * unexpired link is "already verified" rather than invalid.
 */
export const EMAIL_ALREADY_VERIFIED_MESSAGE =
  'This email is already verified. Sign in to continue.';

/** Shown when Better Auth returns 429 for a verification send. */
export const VERIFICATION_RATE_LIMIT_MESSAGE = 'Please wait before requesting another email.';

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

/** Confirm copy before archiving a live project. */
export const ARCHIVE_PROJECT_DESCRIPTION =
  "This project leaves everyone's list. Restore it from Archived. Permanent delete is only available there.";

export const ARCHIVE_PROJECT_LABEL = 'Archive project';

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

/** Occupancy miss: another write already committed on this comment. */
export const COMMENT_CHANGED_ELSEWHERE_MESSAGE = 'This comment changed somewhere else.';

/** Occupancy miss: another write already committed on this membership role. */
export const MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE =
  "This person's role changed somewhere else.";

/** Occupancy miss: the invitation is no longer the pending row the caller read. */
export const INVITATION_NO_LONGER_VALID_MESSAGE = 'This invitation is no longer valid.';

/** Confirm copy before an admin demotes themselves. */
export const REMOVE_ADMIN_SELF_DESCRIPTION =
  'You will no longer be able to invite people, change access, or manage the project. Another admin would have to promote you again.';
