// tests/components/projects/BoardActivityLog.test.tsx
//
// Tests for the project board activity log.
//
// Tested:
// - Groups events under day headers with avatar, sentence, and clock time
// - Quotes a comment body
// - Reads a due moment in the viewer zone and names the zone it was set in
// - Shows empty copy when there are no events
// - Load earlier activity calls onLoadMore
//
// What is covered:
// - Day groups, row chrome, comment quote, empty state, pagination control
//
// Run with: pnpm test:run tests/components/projects/BoardActivityLog.test.tsx
//
// SEE: src/components/projects/BoardActivityLog.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BoardActivityLog from '@/components/projects/BoardActivityLog';
import { ViewerTimeZoneProvider } from '@/components/projects/ViewerTimeZoneProvider';
import type { ActivityEventListItem } from '@/lib/activity';
import { formatActivityClockTime } from '@/lib/activityDisplay';

const actor = { actorName: 'Ada Lovelace', actorUsername: 'ada' };
const now = new Date('2026-08-25T18:00:00');

function item(
  partial: Partial<ActivityEventListItem> &
    Pick<ActivityEventListItem, 'id' | 'type' | 'createdAt' | 'payload'>,
): ActivityEventListItem {
  return {
    actorId: 'user-ada',
    valid: true,
    ...partial,
  };
}

describe('BoardActivityLog', () => {
  it('groups rows by day with avatar, sentence, time, and a comment quote', () => {
    const today = new Date('2026-08-25T14:20:00');
    const yesterday = new Date('2026-08-24T09:05:00');
    const items: ActivityEventListItem[] = [
      item({
        id: 'evt-created',
        type: 'CARD_CREATED',
        createdAt: today.toISOString(),
        payload: {
          ...actor,
          cardId: 'card-1',
          cardTitle: 'Define the home grid',
          columnId: 'col-todo',
          columnTitle: 'To do',
        },
      }),
      item({
        id: 'evt-comment',
        type: 'COMMENT_ADDED',
        createdAt: yesterday.toISOString(),
        payload: {
          ...actor,
          cardId: 'card-1',
          cardTitle: 'Define the home grid',
          commentId: 'comment-1',
          body: 'Ship the grid first.',
        },
      }),
    ];

    render(
      <BoardActivityLog
        items={items}
        loading={false}
        error={null}
        hasMore={false}
        onLoadMore={() => {}}
        now={now}
      />,
    );

    expect(screen.getByRole('region', { name: 'Activity log' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument();
    expect(
      screen.getByText('Ada Lovelace created "Define the home grid" in To do.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ada Lovelace commented on "Define the home grid".'),
    ).toBeInTheDocument();
    expect(screen.getByText('Ship the grid first.')).toBeInTheDocument();
    expect(screen.getAllByText('AL').length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatActivityClockTime(today)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatActivityClockTime(yesterday)).length).toBeGreaterThan(0);
  });

  it('reads a due moment in the viewer zone and names the zone it was set in', () => {
    const previousTz = process.env.TZ;
    process.env.TZ = 'America/Argentina/Buenos_Aires';
    try {
      const items: ActivityEventListItem[] = [
        item({
          id: 'evt-due',
          type: 'DUE_DATE_CHANGED',
          createdAt: new Date('2026-08-25T14:20:00').toISOString(),
          payload: {
            ...actor,
            cardId: 'card-1',
            cardTitle: 'Define the home grid',
            dueDate: '2026-08-25',
            dueTime: '16:00',
            dueTimeZone: 'Europe/Madrid',
          },
        }),
      ];

      render(
        <ViewerTimeZoneProvider>
          <BoardActivityLog
            items={items}
            loading={false}
            error={null}
            hasMore={false}
            onLoadMore={() => {}}
            now={now}
          />
        </ViewerTimeZoneProvider>,
      );

      expect(
        screen.getByText(
          'Ada Lovelace set the due date of "Define the home grid" to 25 Aug 2026 at 11:00am, Madrid time (GMT+02:00).',
        ),
      ).toBeInTheDocument();
    } finally {
      if (previousTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTz;
      }
    }
  });

  it('shows empty copy when there are no events', () => {
    render(
      <BoardActivityLog
        items={[]}
        loading={false}
        error={null}
        hasMore={false}
        onLoadMore={() => {}}
      />,
    );

    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load earlier activity' })).not.toBeInTheDocument();
  });

  it('calls onLoadMore from the load-earlier control', async () => {
    const events = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <BoardActivityLog items={[]} loading={false} error={null} hasMore onLoadMore={onLoadMore} />,
    );

    await events.click(screen.getByRole('button', { name: 'Load earlier activity' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
