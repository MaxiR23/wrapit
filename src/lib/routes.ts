// Which routes a visitor without a session may reach.
//
// Everything that is not listed here is private: the proxy sends a visitor
// without a session to the sign in page. New pages are therefore protected by
// default, and opening one up is a deliberate edit to this file.

import { MAX_ID_LENGTH } from '@/lib/validation/id';

export const HOME_PATH = '/';
export const PROJECTS_PATH = '/projects';
export const MY_TASKS_PATH = '/tasks';
export const ARCHIVED_PATH = '/archived';
export const ACCOUNT_PATH = '/account';
export const SIGN_IN_PATH = '/sign-in';
export const SIGN_UP_PATH = '/sign-up';
export const FORGOT_PASSWORD_PATH = '/forgot-password';
export const RESET_PASSWORD_PATH = '/reset-password';
export const CHECK_EMAIL_PATH = '/check-email';
export const VERIFY_EMAIL_PATH = '/verify-email';

export const ACCOUNT_TABS = ['profile', 'visibility', 'activity'] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

export const DEFAULT_ACCOUNT_TAB: AccountTab = 'profile';

/** Detail page for a single project. */
export function projectPath(projectId: string) {
  return `${PROJECTS_PATH}/${projectId}`;
}

/** Project board with that card's detail open. Unknown cards are ignored by the board. */
export function projectCardPath(projectId: string, cardId: string) {
  return `${projectPath(projectId)}?card=${encodeURIComponent(cardId)}`;
}

/** Archived tasks for a project. */
export function projectArchivedPath(projectId: string) {
  return `${projectPath(projectId)}/archived`;
}

/** Resolves ?card= to a bounded id, or null when missing or unusable. */
export function parseProjectCardId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_ID_LENGTH) return null;
  return trimmed;
}

/** Account screen for a tab. */
export function accountPath(tab: AccountTab) {
  return `${ACCOUNT_PATH}?tab=${tab}`;
}

/** Resolves ?tab= to a known account tab. Missing or unknown values fall back to profile. */
export function parseAccountTab(value: unknown): AccountTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return ACCOUNT_TABS.includes(raw as AccountTab) ? (raw as AccountTab) : DEFAULT_ACCOUNT_TAB;
}

/** True when the query value is exactly one of the three tabs (not a fallback). */
export function isAccountTab(value: unknown): value is AccountTab {
  return typeof value === 'string' && ACCOUNT_TABS.includes(value as AccountTab);
}

/** Pages that show the sign in, sign up, password-reset, or email-verification UI. */
const AUTH_PATHS: readonly string[] = [
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  CHECK_EMAIL_PATH,
  VERIFY_EMAIL_PATH,
];

/** Public pages, matched exactly. */
const PUBLIC_PATHS: readonly string[] = [HOME_PATH];

/** Public path prefixes: the prefix itself and anything below it. */
const PUBLIC_PREFIXES: readonly string[] = ['/api/auth'];

/** Drops a trailing slash so `/sign-in/` is treated as `/sign-in`. */
function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** True for the pages a signed in user has no reason to see. */
export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.includes(normalize(pathname));
}

/** True for routes reachable without a session. */
export function isPublicPath(pathname: string): boolean {
  const path = normalize(pathname);

  return (
    PUBLIC_PATHS.includes(path) ||
    AUTH_PATHS.includes(path) ||
    PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  );
}
