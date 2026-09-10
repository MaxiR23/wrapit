// tests/app/app-layout.test.tsx
//
// Tests for the authenticated (app) layout shell boundary.
//
// Tested:
// - Wraps children in ProjectsShell when a session exists
// - Redirects to sign in when there is no session
// - Loads notifications and the open-task count for the shell
//
// What is covered:
// - Layout composition and the unauthenticated redirect. jsdom cannot prove
//   Next keeps this layout mounted across a client navigation, or that
//   loading.tsx is the Suspense fallback for the page slot.
//
// Run with: pnpm test:run tests/app/app-layout.test.tsx
//
// SEE: src/app/(app)/layout.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const getSession = vi.fn();
const getNotificationsForUser = vi.fn();
const countOpenMyTasksForUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/notifications', () => ({
  getNotificationsForUser,
}));

vi.mock('@/lib/myTasks', () => ({
  countOpenMyTasksForUser,
}));

vi.mock('@/lib/authClient', () => ({
  authClient: { signOut: vi.fn() },
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
  usePathname: () => '/projects',
}));

const { default: AppLayout } = await import('@/app/(app)/layout');

describe('authenticated app layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    getNotificationsForUser.mockResolvedValue({ items: [], unreadCount: 0 });
    countOpenMyTasksForUser.mockResolvedValue(0);
  });

  it('wraps children in the projects shell for a signed-in user', async () => {
    render(await AppLayout({ children: <p>Slot</p> }));

    expect(getNotificationsForUser).toHaveBeenCalledWith('user-ada');
    expect(countOpenMyTasksForUser).toHaveBeenCalledWith(expect.anything(), 'user-ada');
    expect(screen.getByText('Slot')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Account' }).closest('nav')).toBeInTheDocument();
  });

  it('redirects to sign in when there is no session', async () => {
    getSession.mockResolvedValue(null);

    await expect(AppLayout({ children: <p>Slot</p> })).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(redirect).toHaveBeenCalledWith('/sign-in');
    expect(getNotificationsForUser).not.toHaveBeenCalled();
  });
});
