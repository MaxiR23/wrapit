// tests/components/projects/ProjectsMobileHeader.test.tsx
//
// Tests for the mobile projects header account menu.
//
// Tested:
// - Account opens the menu and does not sign out on the first click
// - Sign out from the menu redirects to the sign in page
// - Opening Account closes notifications, and opening the bell closes Account
//
// What is covered:
// - Account menu wiring, OpenPanel exclusion both ways
//
// Run with: pnpm test:run tests/components/projects/ProjectsMobileHeader.test.tsx
//
// SEE: src/components/projects/ProjectsMobileHeader.tsx

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

const { default: ProjectsMobileHeader } =
  await import('@/components/projects/ProjectsMobileHeader');
const { OpenPanelProvider } = await import('@/components/projects/OpenPanel');
const { NotificationsProvider } = await import('@/components/notifications/NotificationsProvider');

const user = { name: 'Ada Lovelace', username: 'ada' };

function renderHeader(ui: ReactElement) {
  return render(
    <OpenPanelProvider>
      <NotificationsProvider>{ui}</NotificationsProvider>
    </OpenPanelProvider>,
  );
}

describe('ProjectsMobileHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ data: { success: true }, error: null });
    listNotifications.mockResolvedValue({ data: { items: [], unreadCount: 0 } });
  });

  it('opens the account menu and does not sign out on the first click', async () => {
    const events = userEvent.setup();

    renderHeader(<ProjectsMobileHeader user={user} />);
    await events.click(screen.getByRole('button', { name: 'Account' }));

    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getAllByRole('dialog', { name: 'Account' }).length).toBeGreaterThan(0);
  });

  it('signs the user out from the menu, redirects to sign in and refreshes', async () => {
    const events = userEvent.setup();

    renderHeader(<ProjectsMobileHeader user={user} />);
    await events.click(screen.getByRole('button', { name: 'Account' }));
    await events.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/sign-in');
    expect(refresh).toHaveBeenCalled();
  });

  it('closes notifications when Account opens and closes Account when the bell opens', async () => {
    const events = userEvent.setup();

    renderHeader(<ProjectsMobileHeader user={user} />);

    await events.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getAllByRole('dialog', { name: 'Notifications' }).length).toBeGreaterThan(0);

    await events.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog', { name: 'Account' }).length).toBeGreaterThan(0);

    await events.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog', { name: 'Notifications' }).length).toBeGreaterThan(0);
  });
});
