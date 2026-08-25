// tests/components/projects/BoardHeader.test.tsx
//
// Tests for the project board header.
//
// Tested:
// - Links back to the projects list
// - Shows desktop and mobile progress copy from the same counts
// - Replaces the bar with empty copy when there are no cards
// - Renders one interactive avatar per member and a Share button
// - Does not render a Labels control
// - Shows a filter badge for active groups and a summary bar
// - Clear on the summary resets filters
//
// What is covered:
// - Back link, progress labels, empty copy, member avatars, filters chrome
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
    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(screen.getByText('1 of 4 cards done')).toBeInTheDocument();
    expect(screen.getByText('1/4 done')).toBeInTheDocument();
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
});
