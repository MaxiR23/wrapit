// Which routes a visitor without a session may reach.
//
// Everything that is not listed here is private: the proxy sends a visitor
// without a session to the sign in page. New pages are therefore protected by
// default, and opening one up is a deliberate edit to this file.

export const HOME_PATH = '/';
export const BOARDS_PATH = '/boards';
export const SIGN_IN_PATH = '/sign-in';
export const SIGN_UP_PATH = '/sign-up';

/** Pages that show the sign in or sign up forms. */
const AUTH_PATHS: readonly string[] = [SIGN_IN_PATH, SIGN_UP_PATH];

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
