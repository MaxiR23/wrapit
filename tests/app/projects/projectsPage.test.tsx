// tests/app/projects/projectsPage.test.tsx
//
// Tests for the projects list page grid.
//
// Tested:
// - Renders the user's real project titles in the grid
// - Shows the pluralized project count
// - Renders the saved list view on first paint
// - Redirects when there is no session
//
// What is covered:
// - Grid from the data layer, saved viewMode, count label, unauthenticated redirect
//
// Run with: pnpm test:run tests/app/projects/projectsPage.test.tsx
//
// SEE: src/app/projects/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const getSession = vi.fn();
const listProjectSummariesForUser = vi.fn();
const getUserPreferences = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/projects', () => ({
  listProjectSummariesForUser,
}));

vi.mock('@/lib/userPreferences', () => ({
  getUserPreferences,
}));

vi.mock('@/actions/createProject', () => ({
  createProject: vi.fn(),
}));

vi.mock('@/actions/updateViewMode', () => ({
  updateViewMode: vi.fn(),
}));

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
  members: [{ id: 'user-ada', name: 'Ada Lovelace', initials: 'AL' }],
};

describe('Projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    getUserPreferences.mockResolvedValue({ viewMode: 'grid' });
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
        members: [{ id: 'user-ada', name: 'Ada Lovelace', initials: 'AL' }],
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
  });
});
