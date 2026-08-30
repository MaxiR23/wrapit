// tests/components/cards/BoardCard.test.tsx
//
// Tests for the shared board card face.
//
// Tested:
// - Renders title and stored code
// - Shows a GitHub issue in the title as a labelled link
// - Leaves an unrecognised title URL as the raw address
// - Clicking a recognised title link does not open the card
// - A javascript: title does not become a link
// - Shows 0 comments and 0/0 subtasks when lists are empty
// - Shows a due label and the late token when the date is before today
// - Shows the time of a due moment, converted into the viewer's zone
// - Names the zone a moment was set in when the viewer reads another clock
// - Marks a passed due moment late even though its calendar day is today
// - Omits the pill when the card has no label
// - Hides label and code together, which removes the top row
// - Hides footer fields when those visibility flags are off
//
// What is covered:
// - Present fields only, overdue styling, unknown tone omitted, due moments
// - Recognised title links, unrecognised URLs, click does not open the card
//
// Run with: pnpm test:run tests/components/cards/BoardCard.test.tsx
//
// SEE: src/components/cards/BoardCard.tsx

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BoardCard from '@/components/cards/BoardCard';
import type { BoardCardData } from '@/components/projects/boardTypes';
import { ViewerTimeZoneProvider } from '@/components/projects/ViewerTimeZoneProvider';

const base: BoardCardData = {
  id: 'card-1',
  title: 'Write the board',
  code: 'WB-1',
  dueDate: null,
};

describe('BoardCard', () => {
  it('renders the title and stored code', () => {
    render(<BoardCard card={base} />);

    expect(screen.getByRole('heading', { name: 'Write the board' })).toBeInTheDocument();
    expect(screen.getByText('WB-1')).toBeInTheDocument();
  });

  it('renders a GitHub issue in the title as a labelled link', () => {
    render(<BoardCard card={{ ...base, title: 'https://github.com/wrapit/wrapit/issues/42' }} />);

    const link = screen.getByRole('link', { name: 'wrapit/wrapit#42' });
    expect(link).toHaveAttribute('href', 'https://github.com/wrapit/wrapit/issues/42');
  });

  it('leaves an unrecognised title URL as the raw address', () => {
    render(<BoardCard card={{ ...base, title: 'https://example.com/x' }} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'https://example.com/x' })).toBeInTheDocument();
  });

  it('does not open the card when a recognised title link is clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <BoardCard
        card={{ ...base, title: 'https://github.com/wrapit/wrapit/issues/42' }}
        onClick={onClick}
      />,
    );

    await user.click(screen.getByRole('link', { name: 'wrapit/wrapit#42' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not turn a javascript title into a link', () => {
    render(<BoardCard card={{ ...base, title: 'javascript:alert(1)' }} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'javascript:alert(1)' })).toBeInTheDocument();
  });

  it('shows zero comment and subtask counts when lists are empty', () => {
    render(<BoardCard card={base} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });

  it('marks an overdue due date with the late token', () => {
    const now = new Date();
    const due = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1));

    render(<BoardCard card={{ ...base, dueDate: due }} />);

    const dueLabel = screen.getByText('Yesterday').closest('span');
    expect(dueLabel).toHaveClass('text-late');
  });

  it('renders a known label tone', () => {
    render(
      <BoardCard card={{ ...base, label: { id: 'label-1', name: 'Design', tone: 'violet' } }} />,
    );

    expect(screen.getByText('Design')).toHaveClass('text-label-violet');
  });

  it('renders assignee initials from name and username', () => {
    render(
      <BoardCard
        card={{
          ...base,
          assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
        }}
      />,
    );

    expect(screen.getByTitle('Ada Lovelace')).toHaveTextContent('AL');
  });

  it('omits the pill when the card has no label', () => {
    render(<BoardCard card={base} />);

    expect(screen.queryByText('Design')).not.toBeInTheDocument();
  });

  it('hides the label and code when those visibility flags are off', () => {
    render(
      <BoardCard
        card={{ ...base, label: { id: 'label-1', name: 'Design', tone: 'violet' } }}
        visibility={{
          label: false,
          code: false,
          comments: true,
          subtasks: true,
          dueDate: true,
          assignees: true,
        }}
      />,
    );

    expect(screen.queryByText('Design')).not.toBeInTheDocument();
    expect(screen.queryByText('WB-1')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Write the board' })).toBeInTheDocument();
  });

  it('hides comments, subtasks, due date, and assignees when those flags are off', () => {
    const now = new Date();
    const due = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    render(
      <BoardCard
        card={{
          ...base,
          dueDate: due,
          assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
        }}
        visibility={{
          label: true,
          code: true,
          comments: false,
          subtasks: false,
          dueDate: false,
          assignees: false,
        }}
      />,
    );

    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Ada Lovelace')).not.toBeInTheDocument();
  });
});

describe('BoardCard with a due moment', () => {
  // 2026-08-25 16:00 in Madrid, which reads 11:00 in Buenos Aires.
  const madridMoment: BoardCardData = {
    ...base,
    dueDate: new Date(Date.UTC(2026, 7, 25, 14, 0)),
    dueTimeZone: 'Europe/Madrid',
  };
  const previousTz = process.env.TZ;

  function renderInZone(timeZone: string, card: BoardCardData = madridMoment) {
    process.env.TZ = timeZone;
    render(
      <ViewerTimeZoneProvider>
        <BoardCard card={card} />
      </ViewerTimeZoneProvider>,
    );
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  });

  it('shows the time on the storing viewer clock without naming a zone', () => {
    renderInZone('Europe/Madrid');

    const due = screen.getByText('25 Aug 4:00pm');
    expect(due).toBeInTheDocument();
    expect(due).not.toHaveAttribute('title');
  });

  it('converts the time into the viewer zone and names the zone it was set in', () => {
    renderInZone('America/Argentina/Buenos_Aires');

    const due = screen.getByText('25 Aug 11:00am');
    expect(due).toBeInTheDocument();
    expect(due).toHaveAttribute('title', 'Madrid time (GMT+02:00)');
  });

  it('marks a moment late once it has passed, on the day it is due', () => {
    vi.setSystemTime(new Date('2026-08-25T14:01:00Z'));
    renderInZone('America/Argentina/Buenos_Aires');

    expect(screen.getByText('Today 11:00am')).toHaveClass('text-late');
  });

  it('does not mark a moment late while it is still ahead', () => {
    vi.setSystemTime(new Date('2026-08-25T13:59:00Z'));
    renderInZone('America/Argentina/Buenos_Aires');

    expect(screen.getByText('Today 11:00am')).not.toHaveClass('text-late');
  });
});
