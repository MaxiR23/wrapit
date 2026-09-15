// tests/components/notifications/NotificationsProvider.test.tsx
//
// Tests for invitation accept/reject side effects in NotificationsProvider.
//
// Tested:
// - A successful accept refreshes the mounted projects page
// - A failed accept does not refresh the page
// - Reject does not refresh the page
// - A new initialUnreadCount after refresh updates the badge
// - The same initialUnreadCount does not wipe a local mark-read
// - A list response that started before mark-all-read does not restore unread
//   items or the badge count
//
// What is covered:
// - router.refresh after accept success only, unread count sync after a
//   persistent-layout refresh, stale list after mark-all-read
//
// Run with: pnpm test:run tests/components/notifications/NotificationsProvider.test.tsx
//
// SEE: src/components/notifications/NotificationsProvider.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { NotificationListItem } from '@/lib/notifications';

const acceptInvitation = vi.fn();
const rejectInvitation = vi.fn();
const listNotifications = vi.fn();
const markAllNotificationsRead = vi.fn();
const refresh = vi.fn();

vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation }));
vi.mock('@/actions/listNotifications', () => ({ listNotifications }));
vi.mock('@/actions/markNotificationRead', () => ({
  markNotificationRead: vi.fn(async () => ({ data: { id: 'n1' } })),
}));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const { OpenPanelProvider } = await import('@/components/projects/OpenPanel');
const { NotificationsProvider, useNotifications } =
  await import('@/components/notifications/NotificationsProvider');

const unreadItem: NotificationListItem = {
  id: 'n1',
  type: 'INVITATION_RECEIVED',
  message: 'Ada invited you to Sprint board',
  read: false,
  createdAt: new Date().toISOString(),
  invitationId: 'invite-1',
  actorName: 'Ada Lovelace',
  actorUsername: 'ada',
};

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
  const { items, unreadCount, markRead, markAllRead, refresh: loadList } = useNotifications();
  return (
    <div>
      <p>unread:{unreadCount}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.read ? 'read' : 'unread'} {item.message}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void loadList()}>
        Load list
      </button>
      <button type="button" onClick={() => void markAllRead()}>
        Mark all as read
      </button>
      {items[0] ? (
        <button type="button" onClick={() => void markRead(items[0].id)}>
          Mark first read
        </button>
      ) : null}
    </div>
  );
}

function renderProvider(initialUnreadCount = 0) {
  return render(
    <OpenPanelProvider>
      <NotificationsProvider initialUnreadCount={initialUnreadCount}>
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
    markAllNotificationsRead.mockResolvedValue({ data: { ok: true } });
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

  it('adopts a new unread count after the layout refreshes', () => {
    const view = renderProvider(1);
    expect(screen.getByText('unread:1')).toBeInTheDocument();

    view.rerender(
      <OpenPanelProvider>
        <NotificationsProvider initialUnreadCount={2}>
          <Actions />
          <ListProbe />
        </NotificationsProvider>
      </OpenPanelProvider>,
    );

    expect(screen.getByText('unread:2')).toBeInTheDocument();
  });

  it('keeps a local mark-read when the unread count from the layout is unchanged', async () => {
    listNotifications.mockResolvedValue({
      data: { items: [unreadItem], unreadCount: 1 },
    });
    const events = userEvent.setup();
    const view = renderProvider(1);

    await events.click(screen.getByRole('button', { name: 'Load list' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark first read' })).toBeInTheDocument();
    });
    await events.click(screen.getByRole('button', { name: 'Mark first read' }));
    expect(screen.getByText('unread:0')).toBeInTheDocument();

    view.rerender(
      <OpenPanelProvider>
        <NotificationsProvider initialUnreadCount={1}>
          <Actions />
          <ListProbe />
        </NotificationsProvider>
      </OpenPanelProvider>,
    );

    expect(screen.getByText('unread:0')).toBeInTheDocument();
  });

  it('does not restore unread items or the count from a list that started before mark-all-read', async () => {
    const events = userEvent.setup();
    const listResolves: Array<
      (value: { data: { items: NotificationListItem[]; unreadCount: number } }) => void
    > = [];
    listNotifications.mockImplementation(
      () =>
        new Promise((resolve) => {
          listResolves.push(resolve);
        }),
    );
    renderProvider(1);

    await events.click(screen.getByRole('button', { name: 'Load list' }));
    await waitFor(() => {
      expect(listResolves).toHaveLength(1);
    });
    listResolves[0]!({ data: { items: [unreadItem], unreadCount: 1 } });
    await waitFor(() => {
      expect(screen.getByText('unread Ada invited you to Sprint board')).toBeInTheDocument();
    });
    expect(screen.getByText('unread:1')).toBeInTheDocument();

    await events.click(screen.getByRole('button', { name: 'Load list' }));
    await waitFor(() => {
      expect(listResolves).toHaveLength(2);
    });
    await events.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(screen.getByText('unread:0')).toBeInTheDocument();
    expect(screen.getByText('read Ada invited you to Sprint board')).toBeInTheDocument();

    await act(async () => {
      listResolves[1]!({ data: { items: [unreadItem], unreadCount: 1 } });
    });

    expect(screen.getByText('unread:0')).toBeInTheDocument();
    expect(screen.getByText('read Ada invited you to Sprint board')).toBeInTheDocument();
    expect(screen.queryByText('unread Ada invited you to Sprint board')).not.toBeInTheDocument();
  });
});
