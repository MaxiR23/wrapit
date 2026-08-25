// tests/app/projects/projectDetail.test.tsx
//
// Tests for the project detail page access gates and shell.
//
// Tested:
// - Renders the project title for a member
// - Wraps the page in the projects shell with Projects as the active nav
// - Shows the board search input, not Search projects
// - Does not render the Members heading
// - Mounts the recents recorder after access is confirmed
// - Calls notFound when getProjectForUser returns null
//
// What is covered:
// - Member happy path, shell chrome, missing project as 404
//
// Run with: pnpm test:run tests/app/projects/projectDetail.test.tsx
//
// SEE: src/app/projects/[projectId]/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const getSession = vi.fn();
const getProjectForUser = vi.fn();
const listProjectMembersForUser = vi.fn();
const getProjectLabelsForUser = vi.fn();
const getUserPreferences = vi.fn();
const recordRecentProject = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/projects', () => ({
  getProjectForUser,
  listProjectMembersForUser,
}));

vi.mock('@/lib/projectLabels', () => ({
  getProjectLabelsForUser,
}));

vi.mock('@/lib/userPreferences', () => ({
  getUserPreferences,
}));

vi.mock('@/lib/notifications', () => ({
  getNotificationsForUser: vi.fn(async () => ({ items: [], unreadCount: 0 })),
}));

vi.mock('@/actions/recordRecentProject', () => ({
  recordRecentProject,
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
  notFound,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/components/projects/ProjectBoard', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@/components/projects/ColumnsEmptyState', () => ({
  default: () => <p>This project has no columns yet. Create one to get started.</p>,
}));

const { default: ProjectDetailPage } = await import('@/app/projects/[projectId]/page');

describe('Project detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    recordRecentProject.mockResolvedValue(undefined);
    listProjectMembersForUser.mockResolvedValue([
      { userId: 'user-ada', name: 'Ada Lovelace', username: 'ada', role: 'OWNER' },
    ]);
    getProjectLabelsForUser.mockResolvedValue([
      { id: 'l0', name: 'Design', tone: 'blue', order: 0 },
    ]);
    getUserPreferences.mockResolvedValue({
      viewMode: 'grid',
      boardVisibility: {
        label: true,
        code: true,
        comments: true,
        subtasks: true,
        dueDate: true,
        assignees: true,
      },
    });
  });

  it('renders the project title for a member inside the projects shell', async () => {
    getProjectForUser.mockResolvedValue({
      id: 'project-1',
      title: 'Sprint board',
      ownerId: 'user-ada',
      columns: [],
    });

    const page = await ProjectDetailPage({ params: Promise.resolve({ projectId: 'project-1' }) });
    render(page);

    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search the board' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Search projects' })).not.toBeInTheDocument();
    const projectLinks = screen.getAllByRole('link', { name: 'Projects' });
    expect(projectLinks.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    expect(getProjectForUser).toHaveBeenCalledWith('project-1', 'user-ada');
    expect(listProjectMembersForUser).toHaveBeenCalledWith('project-1', 'user-ada');
    expect(getProjectLabelsForUser).toHaveBeenCalledWith('project-1', 'user-ada');
    expect(notFound).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(recordRecentProject).toHaveBeenCalledWith('project-1');
    });
  });

  it('renders the board title when the project has columns', async () => {
    getProjectForUser.mockResolvedValue({
      id: 'project-1',
      title: 'Sprint board',
      ownerId: 'user-ada',
      columns: [{ id: 'column-todo', title: 'To do', order: 0, cards: [] }],
    });

    render(await ProjectDetailPage({ params: Promise.resolve({ projectId: 'project-1' }) }));

    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
  });

  it('calls notFound when the project belongs to someone else', async () => {
    getProjectForUser.mockResolvedValue(null);

    await expect(
      ProjectDetailPage({ params: Promise.resolve({ projectId: 'project-1' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound when the project id is unknown', async () => {
    getProjectForUser.mockResolvedValue(null);

    await expect(
      ProjectDetailPage({ params: Promise.resolve({ projectId: 'missing' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
