// tests/components/projects/ProjectsView.test.tsx
//
// Tests for the projects grid/list toggle, mobile list fallback, and search.
//
// Tested:
// - Defaults to the card grid
// - Seeds the list from the initialView prop on first paint
// - Switching to list shows the table on md+ and cards below md
// - Switching back to grid hides the table
// - Toggle persists the new viewMode through the server action
// - Rapid toggles persist the last selection, not a slower earlier write
// - Typing filters visible projects case-insensitively
// - Clearing the query restores the full list
// - A non-matching query shows the empty result
// - Filtering applies in both grid and list and updates the header count
//
// What is covered:
// - Client-side view toggle, initial seed, persistence, last-write-wins,
//   mobile card fallback, in-memory title search
//
// Run with: pnpm test:run tests/components/projects/ProjectsView.test.tsx
//
// SEE: src/components/projects/ProjectsView.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import type { ProjectSummary } from '@/lib/projectGrid';

const updateViewMode = vi.fn();

vi.mock('@/actions/createProject', () => ({
  createProject: vi.fn(),
}));

vi.mock('@/actions/updateViewMode', () => ({
  updateViewMode,
}));

const { default: ProjectsView } = await import('@/components/projects/ProjectsView');
const { default: ProjectsMobileSearch } =
  await import('@/components/projects/ProjectsMobileSearch');
const { ProjectsSearchProvider } = await import('@/components/projects/ProjectsSearch');

const project: ProjectSummary = {
  id: 'project-1',
  title: 'Sprint board',
  status: 'IN_PROGRESS',
  statusLabel: 'In progress',
  taskCount: 24,
  doneCount: 11,
  percent: 46,
  updatedLabel: 'Updated 2 hours ago',
  starred: false,
  members: [{ id: 'user-ada', name: 'Ada Lovelace', initials: 'AL' }],
};

const emptyBoard: ProjectSummary = {
  ...project,
  id: 'project-2',
  title: 'Empty board',
  status: 'NEW',
  statusLabel: 'New',
  taskCount: 0,
  doneCount: 0,
  percent: 0,
};

function renderView(ui: ReactElement, { withSearch = false }: { withSearch?: boolean } = {}) {
  return render(
    <ProjectsSearchProvider>
      {withSearch ? <ProjectsMobileSearch /> : null}
      {ui}
    </ProjectsSearchProvider>,
  );
}

describe('ProjectsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to the grid with one link per project', () => {
    renderView(<ProjectsView projects={[project]} />);

    expect(screen.getByRole('link', { name: /Sprint board/ })).toHaveAttribute(
      'href',
      '/projects/project-1',
    );
    expect(screen.queryByText('24 tasks')).not.toBeInTheDocument();
    expect(screen.getByText('11 of 24 tasks')).toBeInTheDocument();
  });

  it('seeds the list from the initial view without a click', () => {
    renderView(<ProjectsView projects={[project]} initialView="list" />);

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('24 tasks')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(updateViewMode).not.toHaveBeenCalled();
  });

  it('switches to the list table and keeps a card grid for mobile', async () => {
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project]} />);

    await user.click(screen.getByRole('button', { name: 'List' }));

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('24 tasks')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('11 of 24 tasks')).toBeInTheDocument();

    const list = screen.getByText('Project').closest('.hidden');
    expect(list).toHaveClass('hidden', 'md:block');

    const mobileGrid = screen.getByText('11 of 24 tasks').closest('.md\\:hidden');
    expect(mobileGrid).toHaveClass('md:hidden');
  });

  it('returns to the grid when Grid is pressed', async () => {
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project]} />);

    await user.click(screen.getByRole('button', { name: 'List' }));
    await user.click(screen.getByRole('button', { name: 'Grid' }));

    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('24 tasks')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sprint board/ })).toBeInTheDocument();
  });

  it('persists the new viewMode when the toggle is pressed', async () => {
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project]} />);

    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(updateViewMode).toHaveBeenCalledWith({ viewMode: 'list' });

    await user.click(screen.getByRole('button', { name: 'Grid' }));
    expect(updateViewMode).toHaveBeenCalledWith({ viewMode: 'grid' });
  });

  it('persists the last selection when toggled twice quickly', async () => {
    type PendingWrite = {
      viewMode: 'grid' | 'list';
      resolve: () => void;
    };
    const pending: PendingWrite[] = [];
    const persisted: Array<'grid' | 'list'> = [];

    updateViewMode.mockImplementation(({ viewMode }: { viewMode: 'grid' | 'list' }) => {
      return new Promise((resolve) => {
        pending.push({
          viewMode,
          resolve: () => {
            persisted.push(viewMode);
            resolve({ data: { viewMode } });
          },
        });
      });
    });

    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project]} />);

    await user.click(screen.getByRole('button', { name: 'List' }));
    await user.click(screen.getByRole('button', { name: 'Grid' }));

    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => {
      while (pending.length > 0) {
        const newerIndex = pending.findIndex((write) => write.viewMode === 'grid');
        const write = newerIndex >= 0 ? pending.splice(newerIndex, 1)[0] : pending.shift();
        write?.resolve();
      }
      expect(persisted.at(-1)).toBe('grid');
    });

    expect(updateViewMode.mock.calls.at(-1)).toEqual([{ viewMode: 'grid' }]);
  });

  it('filters visible projects case-insensitively as the user types', async () => {
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />, { withSearch: true });

    await user.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'SPRINT');

    expect(screen.getByRole('link', { name: /Sprint board/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Empty board/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 project')).toBeInTheDocument();
  });

  it('restores the full list when the query is cleared', async () => {
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />, { withSearch: true });

    const search = screen.getByRole('searchbox', { name: 'Search projects' });
    await user.type(search, 'sprint');
    expect(screen.queryByRole('link', { name: /Empty board/ })).not.toBeInTheDocument();

    await user.clear(search);

    expect(screen.getByRole('link', { name: /Sprint board/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Empty board/ })).toBeInTheDocument();
    expect(screen.getByText('2 projects')).toBeInTheDocument();
  });

  it('shows an empty result when nothing matches', async () => {
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />, { withSearch: true });

    await user.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'kanban');

    expect(screen.getByText('No projects match your search.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sprint board/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Empty board/ })).not.toBeInTheDocument();
    expect(screen.getByText('0 projects')).toBeInTheDocument();
  });

  it('applies the same filter in the list view', async () => {
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />, { withSearch: true });

    await user.click(screen.getByRole('button', { name: 'List' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'empty');

    expect(screen.getAllByRole('link', { name: /Empty board/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Sprint board/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 project')).toBeInTheDocument();
    expect(screen.getByText('0 tasks')).toBeInTheDocument();
  });
});
