// tests/components/projects/BoardHeader.test.tsx
//
// Tests for the project board header.
//
// Tested:
// - Links back to the projects list
// - Shows desktop and mobile progress copy from the same counts
// - Phone search is a full-width row below the actions, hidden from tablet
// - Phone search shows a leading magnifying-glass icon
// - Search is disabled when the board has no cards
// - Members, Share, Archive and Archived are icon-sized below tablet
// - Phone action icons stay a tight wrapping row so narrow phones keep every control
// - Share, Archive and Archived stay icon-sized through tablet and show labels from lg
// - Board title and actions sit on one row from tablet; action chrome stays compact until lg
// - Progress bar fills the title row below tablet
// - Opening Members lists the people on the board
// - Replaces the bar with empty copy when there are no cards
// - Renders one interactive avatar per member and a Share button
// - Does not render a Labels control
// - Shows a filter badge for active groups and a summary bar
// - Clear on the summary resets filters
// - Shows a clock control after visibility that toggles the activity log
// - Lights the clock when the log is open and closes open popovers on toggle
// - Links to the project's archived tasks
//
// What is covered:
// - Back link, progress labels, empty copy, phone members list, member avatars, filters chrome, activity clock, Archived link
//
// Run with: pnpm test:run tests/components/projects/BoardHeader.test.tsx
//
// SEE: src/components/projects/BoardHeader.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import BoardHeader from '@/components/projects/BoardHeader';
import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import { ProjectsSearchProvider } from '@/components/projects/ProjectsSearch';
import { DEFAULT_BOARD_VISIBILITY, emptyBoardFilters } from '@/lib/boardView';

const members = [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }];
const labels = [{ id: 'label-design', name: 'Design', tone: 'blue' as const, order: 0 }];

function Harness({ children }: { children: ReactNode }) {
  return (
    <OpenPanelProvider>
      <ProjectsSearchProvider>{children}</ProjectsSearchProvider>
    </OpenPanelProvider>
  );
}

function renderHeader(
  props: Partial<Parameters<typeof BoardHeader>[0]> = {},
): ReturnType<typeof render> {
  return render(
    <BoardHeader
      title="Sprint board"
      projectId="project-1"
      doneCount={0}
      taskCount={0}
      percent={0}
      members={[]}
      labels={[]}
      filters={emptyBoardFilters()}
      onFiltersChange={() => {}}
      visibility={DEFAULT_BOARD_VISIBILITY}
      onVisibilityChange={() => {}}
      visibleCount={0}
      {...props}
    />,
    { wrapper: Harness },
  );
}

describe('BoardHeader', () => {
  it('links back to projects and shows both progress labels', () => {
    renderHeader({ doneCount: 1, taskCount: 4, percent: 25, visibleCount: 4 });

    expect(screen.getByRole('link', { name: 'Projects / Board' })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(screen.getByRole('link', { name: 'Archived' })).toHaveAttribute(
      'href',
      '/projects/project-1/archived',
    );
    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sprint board' }).closest('[data-slot="screen-header"]'),
    ).not.toBeNull();
    expect(screen.getByText('1 of 4 cards done')).toBeInTheDocument();
    expect(screen.getByText('1/4 done')).toBeInTheDocument();
    const archive = screen.getByRole('button', { name: 'Archive project' });
    const archived = screen.getByRole('link', { name: 'Archived' });
    expect(archive).toHaveClass('size-10');
    expect(archived).toHaveClass('size-10');
    expect(archive.querySelector('svg')).not.toBeNull();
    expect(archived.querySelector('svg')).not.toBeNull();
    const share = screen.getByRole('button', { name: 'Share' });
    expect(share).toHaveClass('size-10');
    expect(share.querySelector('svg')).not.toBeNull();
    expect(share.parentElement).toHaveClass(
      'flex-wrap',
      'tablet:flex-nowrap',
      'justify-start',
      'gap-2',
    );
    expect(share.parentElement).not.toHaveClass('justify-between');
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveClass('size-10');
    const track = document.querySelector('[data-slot="board-progress"]');
    expect(track).toHaveClass('min-w-0', 'flex-1', 'tablet:flex-none');
    const heading = screen.getByRole('heading', { name: 'Sprint board' });
    expect(heading.parentElement?.parentElement).toHaveClass('w-full', 'tablet:flex-1');
    expect(heading.parentElement?.parentElement?.parentElement).toHaveClass(
      'flex-wrap',
      'tablet:flex-nowrap',
    );
    expect(share.closest('[data-slot="screen-header-actions"]')).toHaveClass(
      'tablet:w-auto',
      'tablet:shrink-0',
      'tablet:flex-nowrap',
    );
  });

  it('keeps Share, Archive and Archived compact through tablet and labels them from lg', () => {
    renderHeader();

    const share = screen.getByRole('button', { name: 'Share' });
    const archive = screen.getByRole('button', { name: 'Archive project' });
    const archived = screen.getByRole('link', { name: 'Archived' });
    expect(share.querySelector('span')).toHaveClass('hidden', 'lg:inline');
    expect(share.querySelector('span')).toHaveTextContent('Share');
    expect(archive.querySelector('span')).toHaveClass('hidden', 'lg:inline');
    expect(archive.querySelector('span')).toHaveTextContent('Archive');
    expect(archived.querySelector('span')).toHaveClass('hidden', 'lg:inline');
    expect(archived.querySelector('span')).toHaveTextContent('Archived');
    expect(share).toHaveClass('size-10', 'lg:w-auto');
    expect(archive).toHaveClass('size-10', 'lg:w-auto');
    expect(archive.querySelector('svg')).toHaveClass('lg:hidden');
    expect(screen.getByRole('button', { name: 'Filters' })).not.toHaveClass('tablet:w-auto');
  });

  it('puts phone search on its own full-width row and disables it without cards', () => {
    renderHeader();

    const search = screen.getByRole('searchbox', { name: 'Search the board' });
    const header = screen
      .getByRole('heading', { name: 'Sprint board' })
      .closest('[data-slot="screen-header"]');
    const identity = screen
      .getByRole('heading', { name: 'Sprint board' })
      .closest('[data-slot="screen-header-identity"]');
    const actions = screen
      .getByRole('button', { name: 'Share' })
      .closest('[data-slot="screen-header-actions"]');

    expect(search).toBeDisabled();
    expect(search).toHaveClass('w-full', 'rounded-md', 'pl-9');
    expect(search.parentElement).toHaveClass('relative', 'tablet:hidden');
    expect(search.parentElement?.querySelector('svg')).not.toBeNull();
    expect(header?.contains(search)).toBe(true);
    expect(identity?.contains(search)).toBe(false);
    expect(actions?.contains(search)).toBe(false);
  });

  it('enables phone search when the board has cards', () => {
    renderHeader({ doneCount: 1, taskCount: 4, percent: 25, visibleCount: 4 });

    expect(screen.getByRole('searchbox', { name: 'Search the board' })).toBeEnabled();
  });

  it('replaces the progress bar with empty copy when there are no cards', () => {
    renderHeader();

    expect(
      screen.getByText('There are no cards yet. You can create the first one in any column.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('0 of 0 cards done')).not.toBeInTheDocument();
    expect(screen.queryByText('0/0 done')).not.toBeInTheDocument();
  });

  it('renders one interactive avatar per member and a Share button', () => {
    renderHeader({ members });

    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.queryByTitle('Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  it('opens the phone members list from the header icon', async () => {
    const events = userEvent.setup();
    renderHeader({
      members: [members[0]!, { id: 'user-ben', name: 'Ben', username: 'ben' }],
    });

    const trigger = screen.getByRole('button', { name: 'Members' });
    expect(trigger).toHaveClass('size-10');
    await events.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Members' })).toHaveTextContent('Ada Lovelace');
    expect(screen.getByRole('dialog', { name: 'Members' })).toHaveTextContent('Ben');
  });

  it('does not render a Labels control in the header', () => {
    renderHeader();

    expect(screen.queryByRole('button', { name: 'Labels' })).not.toBeInTheDocument();
  });

  it('shows a group-count badge and summary while filters are on, and Clear resets them', async () => {
    const events = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderHeader({
      labels,
      taskCount: 9,
      visibleCount: 2,
      filters: { labelIds: [labels[0]!.id, 'label-bug'], onlyMine: true, onlyOverdue: false },
      onFiltersChange,
    });

    expect(screen.getByRole('button', { name: 'Filters' })).toHaveTextContent('2');
    expect(
      screen.getByText('Filtering by Design · only my cards — 2 of 9 cards'),
    ).toBeInTheDocument();

    await events.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onFiltersChange).toHaveBeenCalledWith({
      labelIds: [],
      onlyMine: false,
      onlyOverdue: false,
    });
  });

  it('renders an activity clock after visibility and reports pressed styles', () => {
    const { rerender } = renderHeader({ logOpen: false, onToggleLog: vi.fn() });
    const clock = screen.getByRole('button', { name: 'Activity log' });
    expect(clock).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <BoardHeader
        title="Sprint board"
        projectId="project-1"
        doneCount={0}
        taskCount={0}
        percent={0}
        members={[]}
        labels={[]}
        filters={emptyBoardFilters()}
        onFiltersChange={() => {}}
        visibility={DEFAULT_BOARD_VISIBILITY}
        onVisibilityChange={() => {}}
        visibleCount={0}
        logOpen
        onToggleLog={() => {}}
      />,
    );

    const pressed = screen.getByRole('button', { name: 'Activity log' });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    expect(pressed).toHaveClass('border-border-strong', 'bg-card', 'text-foreground');
  });

  it('calls onToggleLog and closes an open filters popover', async () => {
    const events = userEvent.setup();
    const onToggleLog = vi.fn();
    renderHeader({ onToggleLog, labels });

    await events.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getAllByRole('dialog', { name: 'Filters' }).length).toBeGreaterThan(0);

    await events.click(screen.getByRole('button', { name: 'Activity log' }));
    expect(onToggleLog).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument();
  });

  it('disables Archive for a member', () => {
    renderHeader({ canAdminister: false });

    const button = screen.getByRole('button', { name: 'Archive project' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      'Only owners and admins can restore or delete archived projects.',
    );
  });
});
