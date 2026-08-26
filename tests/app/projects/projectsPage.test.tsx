// tests/app/projects/projectsPage.test.tsx
//
// Tests for the projects list page grid.
//
// Tested:
// - Renders the user's real project titles in the grid
// - Shows the pluralized project count
// - Renders the saved list view on first paint
// - Renders recents chips in query order, mapping ids to loaded summaries
// - Does not render a chip for a recent that is not in the loaded summaries
// - Redirects when there is no session
//
// What is covered:
// - Grid from the data layer, saved viewMode, count label, recents chips,
//   unauthenticated redirect
//
// Run with: pnpm test:run tests/app/projects/projectsPage.test.tsx
//
// SEE: src/app/projects/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const getSession = vi.fn();
const listProjectSummariesForUser = vi.fn();
const listRecentProjectsForUser = vi.fn();
const getUserPreferences = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/projects', () => ({
  listProjectSummariesForUser,
  listRecentProjectsForUser,
}));

vi.mock('@/lib/userPreferences', () => ({
  getUserPreferences,
}));

vi.mock('@/lib/notifications', () => ({
  getNotificationsForUser: vi.fn(async () => ({ items: [], unreadCount: 0 })),
}));

vi.mock('@/lib/myTasks', () => ({
  countOpenMyTasksForUser: vi.fn(async () => 0),
}));

vi.mock('@/actions/createProject', () => ({
  createProject: vi.fn(),
}));

vi.mock('@/actions/updateViewMode', () => ({
  updateViewMode: vi.fn(),
}));

vi.mock('@/actions/setProjectStarred', () => ({
  setProjectStarred: vi.fn(),
}));

vi.mock('@/actions/listNotifications', () => ({
  listNotifications: vi.fn(async () => ({ data: { items: [], unreadCount: 0 } })),
}));
vi.mock('@/actions/markNotificationRead', () => ({ markNotificationRead: vi.fn() }));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead: vi.fn() }));
vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation: vi.fn() }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: ProjectsPage } = await import('@/app/projects/page');

const sprintBoard = {
  id: 'project-1',
  title: 'Sprint board',
  status: 'IN_PROGRESS',
  statusLabel: 'In progress',
  taskCount: 2,
  doneCount: 1,
  percent: 50,
  updatedLabel: 'Updated yesterday',
  starred: false,
  members: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
};

describe('Projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    getUserPreferences.mockResolvedValue({ viewMode: 'grid' });
    listRecentProjectsForUser.mockResolvedValue([]);
  });

  it('renders the user projects in the grid and pluralizes the count', async () => {
    listProjectSummariesForUser.mockResolvedValue([
      sprintBoard,
      {
        id: 'project-2',
        title: 'Empty board',
        status: 'NEW',
        statusLabel: 'New',
        taskCount: 0,
        doneCount: 0,
        percent: 0,
        updatedLabel: 'Updated just now',
        starred: false,
        members: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
      },
    ]);

    render(await ProjectsPage());

    expect(listProjectSummariesForUser).toHaveBeenCalledWith('user-ada');
    expect(getUserPreferences).toHaveBeenCalledWith('user-ada');
    expect(screen.getByRole('link', { name: /Sprint board/ })).toHaveAttribute(
      'href',
      '/projects/project-1',
    );
    expect(screen.getByRole('link', { name: /Empty board/ })).toHaveAttribute(
      'href',
      '/projects/project-2',
    );
    expect(screen.getByText('2 projects')).toBeInTheDocument();
    expect(screen.getByText('0 of 0 tasks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders the saved list view on first paint', async () => {
    getUserPreferences.mockResolvedValue({ viewMode: 'list' });
    listProjectSummariesForUser.mockResolvedValue([sprintBoard]);

    render(await ProjectsPage());

    expect(getUserPreferences).toHaveBeenCalledWith('user-ada');
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('2 tasks')).toBeInTheDocument();
  });

  it('redirects to sign in when there is no session', async () => {
    getSession.mockResolvedValue(null);

    await expect(ProjectsPage()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(redirect).toHaveBeenCalledWith('/sign-in');
    expect(listProjectSummariesForUser).not.toHaveBeenCalled();
    expect(getUserPreferences).not.toHaveBeenCalled();
    expect(listRecentProjectsForUser).not.toHaveBeenCalled();
  });

  it('renders recents chips from the data layer, most recent first', async () => {
    const emptyBoard = {
      ...sprintBoard,
      id: 'project-2',
      title: 'Empty board',
      status: 'NEW' as const,
      statusLabel: 'New',
      taskCount: 0,
      doneCount: 0,
      percent: 0,
    };
    listProjectSummariesForUser.mockResolvedValue([sprintBoard, emptyBoard]);
    listRecentProjectsForUser.mockResolvedValue([
      { projectId: 'project-2' },
      { projectId: 'gone-project' },
      { projectId: 'project-1' },
    ]);

    render(await ProjectsPage());

    expect(listRecentProjectsForUser).toHaveBeenCalledWith('user-ada');
    const recents = screen.getByText('Recents').parentElement;
    const chips = recents?.querySelectorAll('a') ?? [];
    expect([...chips].map((chip) => chip.getAttribute('href'))).toEqual([
      '/projects/project-2',
      '/projects/project-1',
    ]);
  });

  it('renders four recents chips when the data layer already applied the access cap', async () => {
    const boards = [1, 2, 3, 4, 5].map((n) => ({
      ...sprintBoard,
      id: `project-${n}`,
      title: `Board ${n}`,
    }));
    listProjectSummariesForUser.mockResolvedValue(boards);
    listRecentProjectsForUser.mockResolvedValue([
      { projectId: 'project-5' },
      { projectId: 'project-4' },
      { projectId: 'project-3' },
      { projectId: 'project-2' },
    ]);

    render(await ProjectsPage());

    const recents = screen.getByText('Recents').parentElement;
    const chips = recents?.querySelectorAll('a') ?? [];
    expect([...chips].map((chip) => chip.getAttribute('href'))).toEqual([
      '/projects/project-5',
      '/projects/project-4',
      '/projects/project-3',
      '/projects/project-2',
    ]);
  });

  it('does not render a chip for a recent that is not in the loaded summaries', async () => {
    const emptyBoard = {
      ...sprintBoard,
      id: 'project-2',
      title: 'Empty board',
      status: 'NEW' as const,
      statusLabel: 'New',
      taskCount: 0,
      doneCount: 0,
      percent: 0,
    };
    listProjectSummariesForUser.mockResolvedValue([sprintBoard, emptyBoard]);
    listRecentProjectsForUser.mockResolvedValue([
      { projectId: 'membership-project' },
      { projectId: 'foreign-project' },
      { projectId: 'project-1' },
    ]);

    render(await ProjectsPage());

    const recents = screen.getByText('Recents').parentElement;
    const chips = recents?.querySelectorAll('a') ?? [];
    expect([...chips].map((chip) => chip.getAttribute('href'))).toEqual(['/projects/project-1']);
    expect(screen.queryByText('membership-project')).not.toBeInTheDocument();
    expect(screen.queryByText('foreign-project')).not.toBeInTheDocument();
  });
});
