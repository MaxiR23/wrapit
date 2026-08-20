// tests/components/projects/ProjectsTopbar.test.tsx
//
// Tests for the projects topbar account menu and the search input that shares
// query state with the projects list.
//
// Tested:
// - Account opens the menu and does not sign out on the first click
// - Sign out from the menu redirects to the sign in page
// - Opening Account closes notifications, and opening the bell closes Account
// - Switching from Account to the bell leaves focus on the notifications button
// - Renders the Search projects input
//
// What is covered:
// - Account menu wiring, OpenPanel exclusion both ways, focus on switch, search field
//
// Run with: pnpm test:run tests/components/projects/ProjectsTopbar.test.tsx
//
// SEE: src/components/projects/ProjectsTopbar.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

const signOut = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
const listNotifications = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { signOut },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock('@/actions/listNotifications', () => ({ listNotifications }));
vi.mock('@/actions/markNotificationRead', () => ({ markNotificationRead: vi.fn() }));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead: vi.fn() }));
vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation: vi.fn() }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation: vi.fn() }));

const { default: ProjectsTopbar } = await import('@/components/projects/ProjectsTopbar');
const { ProjectsSearchProvider } = await import('@/components/projects/ProjectsSearch');
const { OpenPanelProvider } = await import('@/components/projects/OpenPanel');
const { NotificationsProvider } = await import('@/components/notifications/NotificationsProvider');

const user = { name: 'Ada Lovelace', username: 'ada', initials: 'AL' };

function renderTopbar(ui: ReactElement) {
  return render(
    <OpenPanelProvider>
      <NotificationsProvider>
        <ProjectsSearchProvider>{ui}</ProjectsSearchProvider>
      </NotificationsProvider>
    </OpenPanelProvider>,
  );
}

describe('ProjectsTopbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ data: { success: true }, error: null });
    listNotifications.mockResolvedValue({ data: { items: [], unreadCount: 0 } });
  });

  it('opens the account menu and does not sign out on the first click', async () => {
    const events = userEvent.setup();

    renderTopbar(<ProjectsTopbar user={user} />);
    await events.click(screen.getByRole('button', { name: 'Account' }));

    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getAllByRole('dialog', { name: 'Account' }).length).toBeGreaterThan(0);
  });

  it('signs the user out from the menu, redirects to sign in and refreshes', async () => {
    const events = userEvent.setup();

    renderTopbar(<ProjectsTopbar user={user} />);
    await events.click(screen.getByRole('button', { name: 'Account' }));
    await events.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/sign-in');
    expect(refresh).toHaveBeenCalled();
  });

  it('closes notifications when Account opens and closes Account when the bell opens', async () => {
    const events = userEvent.setup();

    renderTopbar(<ProjectsTopbar user={user} />);

    await events.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getAllByRole('dialog', { name: 'Notifications' }).length).toBeGreaterThan(0);

    await events.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog', { name: 'Account' }).length).toBeGreaterThan(0);

    await events.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog', { name: 'Notifications' }).length).toBeGreaterThan(0);
  });

  it('leaves focus on the notifications button when switching from the account menu', async () => {
    const events = userEvent.setup();

    renderTopbar(<ProjectsTopbar user={user} />);
    const account = screen.getByRole('button', { name: 'Account' });
    const bell = screen.getByRole('button', { name: 'Notifications' });

    await events.click(account);
    await events.click(bell);

    expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
    expect(account).not.toHaveFocus();
  });

  it('renders the Search projects input', () => {
    renderTopbar(<ProjectsTopbar user={user} />);

    expect(screen.getByRole('searchbox', { name: 'Search projects' })).toBeInTheDocument();
  });
});
