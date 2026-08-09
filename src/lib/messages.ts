// Messages shared by more than one component.

/**
 * Shown for any failure that has no recognized code. Deliberately says nothing
 * about what happened: an unexpected error can carry server internals such as a
 * database host or a constraint name, so `error.message` is never rendered.
 */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
