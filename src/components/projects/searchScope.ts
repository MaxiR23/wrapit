import { ACCOUNT_PATH, ARCHIVED_PATH, MY_TASKS_PATH, PROJECTS_PATH } from '@/lib/routes';

/**
 * Search query belongs to a screen, not the shell.
 *
 * The search provider stays mounted across authenticated navigations. One
 * string would leak from /projects onto a board, /tasks, and /archived, and
 * would survive into /account where the input is hidden. Clearing on every
 * pathname change would also drop the query when the user opens a project
 * from the filtered grid (or a task) and comes back — the case that should
 * survive. Key by screen instead. Account has no scope: the query is always
 * empty and setQuery is a no-op.
 *
 * Pathname omits the query string, so `?card=` on a board is the same scope.
 */
export function searchScopeForPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === ACCOUNT_PATH || path.startsWith(`${ACCOUNT_PATH}/`)) return null;
  if (path === MY_TASKS_PATH) return 'tasks';
  if (path === ARCHIVED_PATH) return 'archived';
  if (path === PROJECTS_PATH) return 'projects';

  const rest = path.startsWith(`${PROJECTS_PATH}/`) ? path.slice(PROJECTS_PATH.length + 1) : null;
  if (rest) {
    const segments = rest.split('/');
    if (segments.length === 2 && segments[1] === 'archived' && segments[0]) {
      return `project-archived:${segments[0]}`;
    }
    if (segments.length === 1 && segments[0]) return `board:${segments[0]}`;
  }

  return `path:${path}`;
}
