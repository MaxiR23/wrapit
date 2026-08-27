// tests/app/archived/archivedPage.test.tsx
//
// Tests for the /archived page shell and projects list.
//
// Tested:
// - Renders Archived and the archived-projects search for a signed-in user
// - Redirects when there is no session
//
// What is covered:
// - Authenticated render, unauthenticated redirect
//
// Run with: pnpm test:run tests/app/archived/archivedPage.test.tsx
//
// SEE: src/app/archived/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const getSession = vi.fn();
const listArchivedProjectsForUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/archivedProjectsQuery', () => ({
  listArchivedProjectsForUser,
}));

vi.mock('@/lib/myTasks', () => ({
  countOpenMyTasksForUser: vi.fn(async () => 0),
}));

vi.mock('@/lib/notifications', () => ({
  getNotificationsForUser: vi.fn(async () => ({ items: [], unreadCount: 0 })),
}));

vi.mock('@/actions/restoreArchivedCards', () => ({ restoreArchivedCards: vi.fn() }));
vi.mock('@/actions/rearchiveArchivedCards', () => ({ rearchiveArchivedCards: vi.fn() }));
vi.mock('@/actions/deleteArchivedCards', () => ({ deleteArchivedCards: vi.fn() }));
vi.mock('@/actions/restoreArchivedProjects', () => ({ restoreArchivedProjects: vi.fn() }));
vi.mock('@/actions/rearchiveArchivedProjects', () => ({ rearchiveArchivedProjects: vi.fn() }));
vi.mock('@/actions/deleteArchivedProject', () => ({ deleteArchivedProject: vi.fn() }));
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

const { default: ArchivedProjectsPage } = await import('@/app/archived/page');

describe('Archived projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    listArchivedProjectsForUser.mockResolvedValue([]);
  });

  it('renders Archived and the archived-projects search for a signed-in user', async () => {
    render(await ArchivedProjectsPage());

    expect(listArchivedProjectsForUser).toHaveBeenCalledWith('user-ada');
    expect(screen.getByRole('heading', { name: 'Archived' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('searchbox', { name: 'Search archived projects' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('No archived projects')).toBeInTheDocument();
    const archivedLinks = screen.getAllByRole('link', { name: 'Archived' });
    expect(archivedLinks.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('redirects when there is no session', async () => {
    getSession.mockResolvedValue(null);

    await expect(ArchivedProjectsPage()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(redirect).toHaveBeenCalledWith('/sign-in');
  });
});
