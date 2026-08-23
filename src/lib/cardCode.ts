import { initials } from '@/lib/initials';

const FALLBACK_PREFIX = 'PR';

/** Two-letter prefix from the project title at the moment of card creation. */
export function cardCodePrefix(title: string): string {
  return initials(title) || FALLBACK_PREFIX;
}

/**
 * Stored card code: title initials plus a hyphen and the project's next
 * counter. Call only at create time; renaming the project must not rewrite it.
 */
export function cardCode(title: string, sequence: number): string {
  return `${cardCodePrefix(title)}-${sequence}`;
}
