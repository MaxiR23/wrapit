// tests/components/notifications/NotificationsProvider.test.tsx
//
// Tests for invitation accept/reject side effects in NotificationsProvider.
//
// Tested:
// - A successful accept refreshes the mounted projects page
// - A failed accept does not refresh the page
// - Reject does not refresh the page
//
// What is covered:
// - router.refresh after accept success only
//
// Run with: pnpm test:run tests/components/notifications/NotificationsProvider.test.tsx
//
// SEE: src/components/notifications/NotificationsProvider.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const acceptInvitation = vi.fn();
const rejectInvitation = vi.fn();
const listNotifications = vi.fn();
const refresh = vi.fn();

vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation }));
vi.mock('@/actions/listNotifications', () => ({ listNotifications }));
vi.mock('@/actions/markNotificationRead', () => ({ markNotificationRead: vi.fn() }));
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

function renderProvider() {
  return render(
    <OpenPanelProvider>
      <NotificationsProvider>
        <Actions />
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
});
