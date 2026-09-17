// tests/components/account/AccountActivity.test.tsx
//
// Tests for the account Activity tab.
//
// Tested:
// - Renders project cards with role, assigned count, and a link to the board
// - Groups events by day and names the project on each row
// - Sentences match the board-log formatter, including a comment quote
// - Shows only the projects empty copy when there are no projects
// - Shows the activity empty copy when there are projects but no events
// - Load earlier appends the next page
// - A pending load cannot request the same opaque cursor twice
// - A rejected load shows the generic error and clears busy
//
// What is covered:
// - Projects grid, day groups, formatter reuse, empty, pagination, in-flight deduplication
//
// Run with: pnpm test:run tests/components/account/AccountActivity.test.tsx
//
// SEE: src/components/account/AccountActivity.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AccountActivityEventListItem } from '@/lib/activity';
import { activityCopy } from '@/lib/activityCopy';
import {
  activityEventViewFromItem,
  activitySentence,
  formatActivityClockTime,
} from '@/lib/activityDisplay';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';

const listMyActivityEvents = vi.fn();

vi.mock('@/actions/listMyActivityEvents', () => ({
  listMyActivityEvents,
}));

const { default: AccountActivity } = await import('@/components/account/AccountActivity');

const actor = { actorName: 'Ada Lovelace', actorUsername: 'ada' };
const now = new Date('2026-08-25T18:00:00');

function item(
  partial: Partial<AccountActivityEventListItem> &
    Pick<AccountActivityEventListItem, 'id' | 'type' | 'createdAt' | 'payload' | 'projectTitle'>,
): AccountActivityEventListItem {
  return {
    actorId: 'user-ada',
    valid: true,
    projectId: 'project-1',
    ...partial,
  };
}

describe('AccountActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMyActivityEvents.mockResolvedValue({
      data: { items: [], hasMore: false, nextCursor: null },
    });
  });

  it('renders project cards and groups events by day with matching sentences', () => {
    const today = new Date('2026-08-25T14:20:00');
    const yesterday = new Date('2026-08-24T09:05:00');
    const created = item({
      id: 'evt-created',
      type: 'CARD_CREATED',
      createdAt: today.toISOString(),
      projectTitle: 'Sprint board',
      payload: {
        ...actor,
        cardId: 'card-1',
        cardTitle: 'Define the home grid',
        columnId: 'col-todo',
        columnTitle: 'To do',
      },
    });
    const commented = item({
      id: 'evt-comment',
      type: 'COMMENT_ADDED',
      createdAt: yesterday.toISOString(),
      projectTitle: 'Support',
      projectId: 'project-2',
      payload: {
        ...actor,
        cardId: 'card-1',
        cardTitle: 'Define the home grid',
        commentId: 'comment-1',
        body: 'Ship the grid first.',
      },
    });
    const opened = item({
      id: 'evt-project',
      type: 'PROJECT_CREATED',
      createdAt: today.toISOString(),
      projectTitle: 'Sprint board',
      payload: { ...actor, projectTitle: 'Sprint board' },
    });

    render(
      <AccountActivity
        projects={[
          {
            id: 'project-1',
            title: 'Sprint board',
            description: 'Ship the grid.',
            role: 'OWNER',
            assignedCount: 6,
          },
          {
            id: 'project-2',
            title: 'Support',
            description: null,
            role: 'MEMBER',
            assignedCount: 1,
          },
        ]}
        initialItems={[created, commented, opened]}
        initialHasMore={false}
        initialNextCursor={null}
        now={now}
      />,
    );

    expect(screen.getByRole('link', { name: /Sprint board/ })).toHaveAttribute(
      'href',
      '/projects/project-1',
    );
    expect(screen.getByText('Ship the grid.')).toBeInTheDocument();
    expect(screen.getByText('Owner · 6 cards')).toBeInTheDocument();
    expect(screen.getByText('Member · 1 card')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument();
    expect(
      screen.getByText(activitySentence(activityEventViewFromItem(created))),
    ).toBeInTheDocument();
    expect(
      screen.getByText(activitySentence(activityEventViewFromItem(commented))),
    ).toBeInTheDocument();
    expect(
      screen.getByText(activitySentence(activityEventViewFromItem(opened))),
    ).toBeInTheDocument();
    expect(screen.getByText('Ship the grid first.')).toBeInTheDocument();
    expect(screen.getAllByText('Sprint board').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Support').length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatActivityClockTime(today)).length).toBeGreaterThan(0);
  });

  it('shows only the projects empty copy when there are no projects or events', () => {
    render(
      <AccountActivity
        projects={[]}
        initialItems={[]}
        initialHasMore={false}
        initialNextCursor={null}
        now={now}
      />,
    );

    expect(screen.getByText(activityCopy.emptyProjects)).toBeInTheDocument();
    expect(screen.queryByText(activityCopy.empty)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: activityCopy.loadEarlier }),
    ).not.toBeInTheDocument();
  });

  it('shows the activity empty copy when there are projects but no events', () => {
    render(
      <AccountActivity
        projects={[
          {
            id: 'project-1',
            title: 'Sprint board',
            description: null,
            role: 'OWNER',
            assignedCount: 0,
          },
        ]}
        initialItems={[]}
        initialHasMore={false}
        initialNextCursor={null}
        now={now}
      />,
    );

    expect(screen.queryByText(activityCopy.emptyProjects)).not.toBeInTheDocument();
    expect(screen.getByText(activityCopy.empty)).toBeInTheDocument();
  });

  it('appends the next page from load earlier', async () => {
    const events = userEvent.setup();
    const first = item({
      id: 'evt-1',
      type: 'PROJECT_CREATED',
      createdAt: new Date('2026-08-25T14:00:00').toISOString(),
      projectTitle: 'Sprint board',
      payload: { ...actor, projectTitle: 'Sprint board' },
    });
    const earlier = item({
      id: 'evt-0',
      type: 'CARD_CREATED',
      createdAt: new Date('2026-08-24T10:00:00').toISOString(),
      projectTitle: 'Sprint board',
      payload: {
        ...actor,
        cardId: 'card-1',
        cardTitle: 'Older task',
        columnId: 'col-todo',
        columnTitle: 'To do',
      },
    });
    listMyActivityEvents.mockResolvedValue({
      data: { items: [earlier], hasMore: false, nextCursor: null },
    });

    render(
      <AccountActivity
        projects={[]}
        initialItems={[first]}
        initialHasMore
        initialNextCursor="opaque-cursor"
        now={now}
      />,
    );

    await events.click(screen.getByRole('button', { name: activityCopy.loadEarlier }));

    await waitFor(() => {
      expect(
        screen.getByText(activitySentence(activityEventViewFromItem(earlier))),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(activitySentence(activityEventViewFromItem(first))),
    ).toBeInTheDocument();
    expect(listMyActivityEvents).toHaveBeenCalledWith({
      cursor: 'opaque-cursor',
    });
    expect(
      screen.queryByRole('button', { name: activityCopy.loadEarlier }),
    ).not.toBeInTheDocument();
  });

  it('does not request the same activity cursor twice while loading', async () => {
    let resolveLoad: (() => void) | undefined;
    listMyActivityEvents.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = () => resolve({ data: { items: [], hasMore: false, nextCursor: null } });
        }),
    );

    const first = item({
      id: 'evt-seed',
      type: 'PROJECT_CREATED',
      createdAt: new Date('2026-08-25T16:00:00').toISOString(),
      projectTitle: 'Sprint board',
      payload: { ...actor, projectTitle: 'Sprint board' },
    });
    render(
      <AccountActivity
        projects={[]}
        initialItems={[first]}
        initialHasMore
        initialNextCursor="opaque-cursor"
        now={now}
      />,
    );

    const button = screen.getByRole('button', { name: activityCopy.loadEarlier });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(listMyActivityEvents).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    resolveLoad?.();
    await waitFor(() => expect(button).not.toBeInTheDocument());
  });

  it('clears loading and shows an error when the list rejects', async () => {
    const events = userEvent.setup();
    listMyActivityEvents.mockRejectedValue(new Error('db down'));

    render(
      <AccountActivity
        projects={[]}
        initialItems={[
          item({
            id: 'evt-1',
            type: 'PROJECT_CREATED',
            createdAt: new Date('2026-08-25T14:00:00').toISOString(),
            projectTitle: 'Sprint board',
            payload: { ...actor, projectTitle: 'Sprint board' },
          }),
        ]}
        initialHasMore
        initialNextCursor="opaque-cursor"
        now={now}
      />,
    );

    await events.click(screen.getByRole('button', { name: activityCopy.loadEarlier }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    });
    expect(screen.getByRole('region', { name: activityCopy.accountLogLabel })).toHaveAttribute(
      'aria-busy',
      'false',
    );
  });
});
