// tests/components/notifications/NotificationsBell.test.tsx
//
// Tests for the notifications bell, popover, and mobile sheet chrome.
//
// Tested:
// - Badge reflects unread count
// - Opening the panel fetches notifications again
// - Desktop popover uses hidden tablet:block; mobile sheet uses tablet:hidden
//
// What is covered:
// - Badge, refetch on open, CSS split
//
// Run with: pnpm test:run tests/components/notifications/NotificationsBell.test.tsx
//
// SEE: src/components/notifications/NotificationsBell.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import type { NotificationListItem } from '@/lib/notifications';

const listNotifications = vi.fn();
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
const acceptInvitation = vi.fn();
const rejectInvitation = vi.fn();

vi.mock('@/actions/listNotifications', () => ({ listNotifications }));
vi.mock('@/actions/markNotificationRead', () => ({ markNotificationRead }));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead }));
vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { OpenPanelProvider } = await import('@/components/projects/OpenPanel');
const { NotificationsProvider } = await import('@/components/notifications/NotificationsProvider');
const { NotificationsBell, NotificationsPopover, NotificationsSheet } =
  await import('@/components/notifications/NotificationsBell');

const unreadItem: NotificationListItem = {
  id: 'n1',
  type: 'INVITATION_RECEIVED',
  message: 'Ada Lovelace invited you to Sprint board',
  read: false,
  createdAt: new Date().toISOString(),
  invitationId: 'invite-1',
  actorName: 'Ada Lovelace',
  actorUsername: 'ada',
};

function Shell({
  children,
  initialItems = [unreadItem],
}: {
  children: ReactNode;
  initialItems?: NotificationListItem[];
}) {
  return (
    <OpenPanelProvider>
      <NotificationsProvider initialItems={initialItems}>{children}</NotificationsProvider>
    </OpenPanelProvider>
  );
}

describe('NotificationsBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listNotifications.mockResolvedValue({
      data: { items: [unreadItem], unreadCount: 1 },
    });
  });

  it('shows an unread badge from the initial fetch', async () => {
    render(
      <Shell>
        <NotificationsBell />
      </Shell>,
    );

    expect(screen.getByLabelText('Notifications, 1 unread')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('refetches when the panel opens and uses CSS-only popover and sheet chrome', async () => {
    const events = userEvent.setup();
    render(
      <Shell>
        <div className="relative">
          <NotificationsBell />
          <NotificationsPopover />
        </div>
        <NotificationsSheet />
      </Shell>,
    );

    expect(listNotifications).not.toHaveBeenCalled();

    await events.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));

    await waitFor(() => {
      expect(listNotifications).toHaveBeenCalledTimes(1);
    });

    const dialogs = screen.getAllByRole('dialog', { name: 'Notifications' });
    expect(dialogs).toHaveLength(2);
    expect(dialogs.some((dialog) => dialog.className.includes('hidden tablet:block'))).toBe(true);
    expect(dialogs.some((dialog) => dialog.className.includes('tablet:hidden'))).toBe(true);
  });
});
