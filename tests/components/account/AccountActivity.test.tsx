// tests/components/account/AccountActivity.test.tsx
//
// Tests for the account Activity tab.
//
// Tested:
// - Renders project cards with role, assigned count, and a link to the board
// - Groups events by day and names the project on each row
// - Sentences match the board-log formatter, including a comment quote
// - Shows empty copy when there are no projects or events
// - Load earlier appends the next page
// - An older in-flight page does not overwrite a newer one
// - A rejected load shows the generic error and clears busy
//
// What is covered:
// - Projects grid, day groups, formatter reuse, empty, pagination, races
//
// Run with: pnpm test:run tests/components/account/AccountActivity.test.tsx
//
// SEE: src/components/account/AccountActivity.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    listMyActivityEvents.mockResolvedValue({ data: { items: [], nextCursor: null } });
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
        initialCursor={null}
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

  it('shows empty copy when there are no projects or events', () => {
    render(<AccountActivity projects={[]} initialItems={[]} initialCursor={null} now={now} />);

    expect(screen.getByText(activityCopy.emptyProjects)).toBeInTheDocument();
    expect(screen.getByText(activityCopy.empty)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: activityCopy.loadEarlier }),
    ).not.toBeInTheDocument();
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
    listMyActivityEvents.mockResolvedValue({ data: { items: [earlier], nextCursor: null } });

    render(
      <AccountActivity
        projects={[]}
        initialItems={[first]}
        initialCursor={{ createdAt: first.createdAt, id: first.id }}
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
      cursor: { createdAt: first.createdAt, id: first.id },
    });
    expect(
      screen.queryByRole('button', { name: activityCopy.loadEarlier }),
    ).not.toBeInTheDocument();
  });

  it('does not let an older activity load overwrite a newer one', async () => {
    const resolvers: Array<
      (result: { data: { items: AccountActivityEventListItem[]; nextCursor: null } }) => void
    > = [];
    listMyActivityEvents.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const first = item({
      id: 'evt-seed',
      type: 'PROJECT_CREATED',
      createdAt: new Date('2026-08-25T16:00:00').toISOString(),
      projectTitle: 'Sprint board',
      payload: { ...actor, projectTitle: 'Sprint board' },
    });
    const older = item({
      id: 'evt-old',
      type: 'CARD_CREATED',
      createdAt: new Date('2026-08-25T14:00:00').toISOString(),
      projectTitle: 'Sprint board',
      payload: {
        ...actor,
        cardId: 'card-1',
        cardTitle: 'Old task',
        columnId: 'col-todo',
        columnTitle: 'To do',
      },
    });
    const newer = item({
      ...older,
      id: 'evt-new',
      createdAt: new Date('2026-08-25T15:00:00').toISOString(),
      payload: { ...older.payload, cardTitle: 'New task' },
    });

    render(
      <AccountActivity
        projects={[]}
        initialItems={[first]}
        initialCursor={{ createdAt: first.createdAt, id: first.id }}
        now={now}
      />,
    );

    const button = screen.getByRole('button', { name: activityCopy.loadEarlier });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => {
      expect(resolvers).toHaveLength(2);
    });

    await act(async () => {
      resolvers[1]!({ data: { items: [newer], nextCursor: null } });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        screen.getByText(activitySentence(activityEventViewFromItem(newer))),
      ).toBeInTheDocument();
    });

    await act(async () => {
      resolvers[0]!({ data: { items: [older], nextCursor: null } });
      await Promise.resolve();
    });
    expect(
      screen.getByText(activitySentence(activityEventViewFromItem(newer))),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(activitySentence(activityEventViewFromItem(older))),
    ).not.toBeInTheDocument();
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
        initialCursor={{ createdAt: new Date('2026-08-25T14:00:00').toISOString(), id: 'evt-1' }}
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
