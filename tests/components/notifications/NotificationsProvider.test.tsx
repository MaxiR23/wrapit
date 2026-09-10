// tests/components/notifications/NotificationsProvider.test.tsx
//
// Tests for invitation accept/reject side effects in NotificationsProvider.
//
// Tested:
// - A successful accept refreshes the mounted projects page
// - A failed accept does not refresh the page
// - Reject does not refresh the page
// - A new initialItems prop after refresh updates the list
// - The same initialItems reference does not wipe local state
//
// What is covered:
// - router.refresh after accept success only, initialItems sync after a
//   persistent-layout refresh
//
// Run with: pnpm test:run tests/components/notifications/NotificationsProvider.test.tsx
//
// SEE: src/components/notifications/NotificationsProvider.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { NotificationListItem } from '@/lib/notifications';

const acceptInvitation = vi.fn();
const rejectInvitation = vi.fn();
const listNotifications = vi.fn();
const refresh = vi.fn();

vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation }));
vi.mock('@/actions/listNotifications', () => ({ listNotifications }));
vi.mock('@/actions/markNotificationRead', () => ({
  markNotificationRead: vi.fn(async () => ({ data: { id: 'n1' } })),
}));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const { OpenPanelProvider } = await import('@/components/projects/OpenPanel');
const { NotificationsProvider, useNotifications } =
  await import('@/components/notifications/NotificationsProvider');

function Actions() {
  const { accept, reject } = useNotifications();
  return (
    <>
      <button type="button" onClick={() => void accept('invite-1')}>
        Accept invite
      </button>
      <button type="button" onClick={() => void reject('invite-1')}>
        Decline invite
      </button>
    </>
  );
}

function ListProbe() {
  const { items, unreadCount, markRead } = useNotifications();
  return (
    <div>
      <p>unread:{unreadCount}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.message}</li>
        ))}
      </ul>
      {items[0] ? (
        <button type="button" onClick={() => void markRead(items[0].id)}>
          Mark first read
        </button>
      ) : null}
    </div>
  );
}

function renderProvider(initialItems?: NotificationListItem[]) {
  return render(
    <OpenPanelProvider>
      <NotificationsProvider initialItems={initialItems}>
        <Actions />
        <ListProbe />
      </NotificationsProvider>
    </OpenPanelProvider>,
  );
}

describe('NotificationsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listNotifications.mockResolvedValue({ data: { items: [], unreadCount: 0 } });
  });

  it('refreshes the projects page after a successful acceptance', async () => {
    acceptInvitation.mockResolvedValue({ data: { id: 'invite-1' } });
    const events = userEvent.setup();
    renderProvider();

    await events.click(screen.getByRole('button', { name: 'Accept invite' }));

    await waitFor(() => {
      expect(acceptInvitation).toHaveBeenCalledWith('invite-1');
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the projects page when acceptance fails', async () => {
    acceptInvitation.mockResolvedValue({ error: 'Unauthorized' });
    const events = userEvent.setup();
    renderProvider();

    await events.click(screen.getByRole('button', { name: 'Accept invite' }));

    await waitFor(() => {
      expect(acceptInvitation).toHaveBeenCalledWith('invite-1');
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not refresh the projects page after a reject', async () => {
    rejectInvitation.mockResolvedValue({ data: { id: 'invite-1' } });
    const events = userEvent.setup();
    renderProvider();

    await events.click(screen.getByRole('button', { name: 'Decline invite' }));

    await waitFor(() => {
      expect(rejectInvitation).toHaveBeenCalledWith('invite-1');
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('adopts a new initialItems list after the layout refreshes', () => {
    const first: NotificationListItem = {
      id: 'n1',
      type: 'INVITATION_RECEIVED',
      message: 'Ada invited you to Sprint board',
      read: false,
      createdAt: new Date().toISOString(),
      invitationId: 'invite-1',
      actorName: 'Ada Lovelace',
      actorUsername: 'ada',
    };
    const arrived: NotificationListItem = {
      ...first,
      id: 'n2',
      invitationId: 'invite-2',
      message: 'Ada invited you to App mobile',
    };

    const view = renderProvider([first]);
    expect(screen.getByText('unread:1')).toBeInTheDocument();
    expect(screen.getByText('Ada invited you to Sprint board')).toBeInTheDocument();

    view.rerender(
      <OpenPanelProvider>
        <NotificationsProvider initialItems={[first, arrived]}>
          <Actions />
          <ListProbe />
        </NotificationsProvider>
      </OpenPanelProvider>,
    );

    expect(screen.getByText('unread:2')).toBeInTheDocument();
    expect(screen.getByText('Ada invited you to App mobile')).toBeInTheDocument();
  });

  it('keeps local unread changes when initialItems is the same list', async () => {
    const first: NotificationListItem = {
      id: 'n1',
      type: 'INVITATION_RECEIVED',
      message: 'Ada invited you to Sprint board',
      read: false,
      createdAt: new Date().toISOString(),
      invitationId: 'invite-1',
      actorName: 'Ada Lovelace',
      actorUsername: 'ada',
    };
    const initialItems = [first];
    const events = userEvent.setup();
    const view = renderProvider(initialItems);

    await events.click(screen.getByRole('button', { name: 'Mark first read' }));
    expect(screen.getByText('unread:0')).toBeInTheDocument();

    view.rerender(
      <OpenPanelProvider>
        <NotificationsProvider initialItems={initialItems}>
          <Actions />
          <ListProbe />
        </NotificationsProvider>
      </OpenPanelProvider>,
    );

    expect(screen.getByText('unread:0')).toBeInTheDocument();
  });
});
