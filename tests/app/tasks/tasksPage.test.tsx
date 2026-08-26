// tests/app/tasks/tasksPage.test.tsx
//
// Tests for the /tasks page shell and list.
//
// Tested:
// - Renders My tasks and the search field for a signed-in user
// - Redirects when there is no session
//
// What is covered:
// - Authenticated render, unauthenticated redirect
//
// Run with: pnpm test:run tests/app/tasks/tasksPage.test.tsx
//
// SEE: src/app/tasks/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const getSession = vi.fn();
const listMyTasksForUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/myTasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/myTasks')>();
  return {
    ...actual,
    listMyTasksForUser,
    countOpenMyTasksForUser: vi.fn(async () => 0),
  };
});

vi.mock('@/lib/notifications', () => ({
  getNotificationsForUser: vi.fn(async () => ({ items: [], unreadCount: 0 })),
}));

vi.mock('@/actions/createCard', () => ({ createCard: vi.fn() }));
vi.mock('@/actions/setCardCompleted', () => ({ setCardCompleted: vi.fn() }));
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

const { default: MyTasksPage } = await import('@/app/tasks/page');

describe('My tasks page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    listMyTasksForUser.mockResolvedValue({
      tasks: [],
      createProjects: [],
      openCount: 0,
    });
  });

  it('renders My tasks and the task search for a signed-in user', async () => {
    render(await MyTasksPage());

    expect(listMyTasksForUser).toHaveBeenCalledWith(expect.anything(), 'user-ada');
    expect(screen.getByRole('heading', { name: 'My tasks' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toBeInTheDocument();
    expect(screen.getByText('Nothing pending here')).toBeInTheDocument();
  });

  it('redirects when there is no session', async () => {
    getSession.mockResolvedValue(null);

    await expect(MyTasksPage()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(redirect).toHaveBeenCalledWith('/sign-in');
  });
});
