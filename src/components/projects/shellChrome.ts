import type { ProjectsShellActiveNav } from '@/components/projects/shell';
import { archivedCopy } from '@/lib/archivedCopy';
import { ACCOUNT_PATH, ARCHIVED_PATH, MY_TASKS_PATH, PROJECTS_PATH } from '@/lib/routes';

export const SHELL_FILL_CONTENT_CLASS_NAME = 'flex min-h-0 flex-1 flex-col overflow-hidden';

export type ShellChrome = {
  activeNav: ProjectsShellActiveNav;
  showSearch: boolean;
  searchPlaceholder: string;
  searchAriaLabel: string;
  mobileTitle: string;
  contentClassName: string | undefined;
};

const PROJECTS_CHROME: ShellChrome = {
  activeNav: 'projects',
  showSearch: true,
  searchPlaceholder: 'Search projects',
  searchAriaLabel: 'Search projects',
  mobileTitle: 'Projects',
  contentClassName: undefined,
};

const BOARD_CHROME: ShellChrome = {
  ...PROJECTS_CHROME,
  searchPlaceholder: 'Search the board',
  searchAriaLabel: 'Search the board',
  contentClassName: SHELL_FILL_CONTENT_CLASS_NAME,
};

const PROJECT_ARCHIVED_CHROME: ShellChrome = {
  ...PROJECTS_CHROME,
  searchPlaceholder: archivedCopy.searchPlaceholder,
  searchAriaLabel: archivedCopy.searchAriaLabel,
  mobileTitle: archivedCopy.title,
};

const TASKS_CHROME: ShellChrome = {
  activeNav: 'tasks',
  showSearch: true,
  searchPlaceholder: 'Search tasks',
  searchAriaLabel: 'Search tasks',
  mobileTitle: 'My tasks',
  contentClassName: undefined,
};

const ARCHIVED_CHROME: ShellChrome = {
  activeNav: 'archived',
  showSearch: true,
  searchPlaceholder: archivedCopy.projects.searchPlaceholder,
  searchAriaLabel: archivedCopy.projects.searchAriaLabel,
  mobileTitle: archivedCopy.title,
  contentClassName: undefined,
};

const ACCOUNT_CHROME: ShellChrome = {
  activeNav: 'account',
  showSearch: false,
  searchPlaceholder: 'Search projects',
  searchAriaLabel: 'Search projects',
  mobileTitle: 'Account',
  contentClassName: SHELL_FILL_CONTENT_CLASS_NAME,
};

/** Chrome props each authenticated page used to pass into ProjectsShell. */
export function shellChromeForPath(pathname: string): ShellChrome {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === ACCOUNT_PATH || path.startsWith(`${ACCOUNT_PATH}/`)) return ACCOUNT_CHROME;
  if (path === MY_TASKS_PATH) return TASKS_CHROME;
  if (path === ARCHIVED_PATH) return ARCHIVED_CHROME;
  if (path === PROJECTS_PATH) return PROJECTS_CHROME;

  const rest = path.startsWith(`${PROJECTS_PATH}/`) ? path.slice(PROJECTS_PATH.length + 1) : null;
  if (rest) {
    const segments = rest.split('/');
    if (segments.length === 2 && segments[1] === 'archived') return PROJECT_ARCHIVED_CHROME;
    if (segments.length === 1 && segments[0]) return BOARD_CHROME;
  }

  return PROJECTS_CHROME;
}
