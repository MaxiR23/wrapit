// tests/components/projects/shellChrome.test.ts
//
// Tests for the pathname-to-shell-chrome mapping used by the authenticated
// layout so one shell can serve every signed-in route.
//
// Tested:
// - /projects uses the default list pane and Search projects
// - /projects/:id uses the fill pane and Search the board
// - /projects/:id/archived keeps Projects nav, the default pane, and archived
//   task search copy
// - /tasks, /archived, and /account match the props those pages used to pass
//
// What is covered:
// - The six current ProjectsShell prop sets. jsdom cannot prove the layout
//   re-renders those props on a real Next navigation.
//
// Run with: pnpm test:run tests/components/projects/shellChrome.test.ts
//
// SEE: src/components/projects/shellChrome.ts

import { describe, it, expect } from 'vitest';

import { archivedCopy } from '@/lib/archivedCopy';
import {
  SHELL_FILL_CONTENT_CLASS_NAME,
  shellChromeForPath,
} from '@/components/projects/shellChrome';

describe('shellChromeForPath', () => {
  it('uses the default list pane and Search projects on /projects', () => {
    expect(shellChromeForPath('/projects')).toEqual({
      activeNav: 'projects',
      showSearch: true,
      searchPlaceholder: 'Search projects',
      searchAriaLabel: 'Search projects',
      mobileTitle: 'Projects',
      contentClassName: undefined,
    });
  });

  it('uses the fill pane and Search the board on a project board', () => {
    expect(shellChromeForPath('/projects/project-1')).toEqual({
      activeNav: 'projects',
      showSearch: true,
      searchPlaceholder: 'Search the board',
      searchAriaLabel: 'Search the board',
      mobileTitle: 'Projects',
      contentClassName: SHELL_FILL_CONTENT_CLASS_NAME,
    });
  });

  it('keeps Projects nav and the default pane on project archived tasks', () => {
    expect(shellChromeForPath('/projects/project-1/archived')).toEqual({
      activeNav: 'projects',
      showSearch: true,
      searchPlaceholder: archivedCopy.searchPlaceholder,
      searchAriaLabel: archivedCopy.searchAriaLabel,
      mobileTitle: archivedCopy.title,
      contentClassName: undefined,
    });
  });

  it('uses Search tasks on /tasks', () => {
    expect(shellChromeForPath('/tasks')).toEqual({
      activeNav: 'tasks',
      showSearch: true,
      searchPlaceholder: 'Search tasks',
      searchAriaLabel: 'Search tasks',
      mobileTitle: 'My tasks',
      contentClassName: undefined,
    });
  });

  it('uses archived-projects search copy on /archived', () => {
    expect(shellChromeForPath('/archived')).toEqual({
      activeNav: 'archived',
      showSearch: true,
      searchPlaceholder: archivedCopy.projects.searchPlaceholder,
      searchAriaLabel: archivedCopy.projects.searchAriaLabel,
      mobileTitle: archivedCopy.title,
      contentClassName: undefined,
    });
  });

  it('hides search and uses the fill pane on /account', () => {
    expect(shellChromeForPath('/account')).toEqual({
      activeNav: 'account',
      showSearch: false,
      searchPlaceholder: 'Search projects',
      searchAriaLabel: 'Search projects',
      mobileTitle: 'Account',
      contentClassName: SHELL_FILL_CONTENT_CLASS_NAME,
    });
  });
});
