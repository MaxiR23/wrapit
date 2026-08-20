// tests/components/notifications/NotificationsPanelContent.test.tsx
//
// Tests for the shared notifications panel content.
//
// Tested:
// - Shows No notifications when the list is empty
// - Renders message, relative time, unread dot, and Accept / Decline
// - Clicking an item marks it read
// - Mark all as read marks every item
// - Accept and Decline call the invitation handlers
//
// What is covered:
// - Empty, list, mark read, mark all, accept, reject
//
// Run with: pnpm test:run tests/components/notifications/NotificationsPanelContent.test.tsx
//
// SEE: src/components/notifications/NotificationsPanelContent.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NotificationsPanelContent } from '@/components/notifications/NotificationsPanelContent';
import type { NotificationListItem } from '@/lib/notifications';

const received: NotificationListItem = {
  id: 'n1',
  type: 'INVITATION_RECEIVED',
  message: 'Ada Lovelace invited you to Sprint board',
  read: false,
  createdAt: new Date().toISOString(),
  invitationId: 'invite-1',
  actorName: 'Ada Lovelace',
  actorUsername: 'ada',
};

const accepted: NotificationListItem = {
  id: 'n2',
  type: 'INVITATION_ACCEPTED',
  message: 'Maxi accepted your invitation to Sprint board',
  read: true,
  createdAt: new Date().toISOString(),
  invitationId: 'invite-2',
  actorName: 'Maxi',
  actorUsername: 'maxi',
};

describe('NotificationsPanelContent', () => {
  it('shows No notifications when the list is empty', () => {
    render(
      <NotificationsPanelContent
        items={[]}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('No notifications')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('renders list items with Accept and Decline on invitation rows', () => {
    render(
      <NotificationsPanelContent
        items={[received, accepted]}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('Ada Lovelace invited you to Sprint board')).toBeInTheDocument();
    expect(screen.getByText('Maxi accepted your invitation to Sprint board')).toBeInTheDocument();
    expect(screen.getByLabelText('Unread')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('marks an item read when its row is clicked', async () => {
    const onMarkRead = vi.fn();
    const events = userEvent.setup();
    render(
      <NotificationsPanelContent
        items={[received]}
        onMarkRead={onMarkRead}
        onMarkAllRead={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    await events.click(screen.getByText('Ada Lovelace invited you to Sprint board'));

    expect(onMarkRead).toHaveBeenCalledWith('n1');
  });

  it('marks all as read from the header button', async () => {
    const onMarkAllRead = vi.fn();
    const events = userEvent.setup();
    render(
      <NotificationsPanelContent
        items={[received]}
        onMarkRead={vi.fn()}
        onMarkAllRead={onMarkAllRead}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    await events.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it('accepts and declines from invitation actions', async () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const events = userEvent.setup();
    render(
      <NotificationsPanelContent
        items={[received]}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    await events.click(screen.getByRole('button', { name: 'Accept' }));
    await events.click(screen.getByRole('button', { name: 'Decline' }));

    expect(onAccept).toHaveBeenCalledWith('invite-1');
    expect(onReject).toHaveBeenCalledWith('invite-1');
  });
});
