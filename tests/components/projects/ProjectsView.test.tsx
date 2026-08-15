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
// - Starred section appears only when a project is starred
// - Toggling star moves a project between Starred and the main list
// - Rapid toggles on one project persist only the last intended value
// - Rapid triple-toggle coalesces to the final intended value
// - Writes for the same project never overlap
// - Toggles on different projects are not blocked by each other
// - An error mid-loop stops writes and reconciles to server truth
// - A single failed star toggle rolls back the optimistic star to last persisted
// - Starred stays cards in list view
// - Recents chips render in the given order and hide when empty
//
// What is covered:
// - Client-side view toggle, initial seed, persistence, last-write-wins,
//   mobile card fallback, in-memory title search, starred section, recents,
//   per-project star write coalescing, optimistic star rollback
//
// Run with: pnpm test:run tests/components/projects/ProjectsView.test.tsx
//
// SEE: src/components/projects/ProjectsView.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import type { ProjectSummary } from '@/lib/projectGrid';

const updateViewMode = vi.fn();
const setProjectStarred = vi.fn();
const refresh = vi.fn();

vi.mock('@/actions/createProject', () => ({
  createProject: vi.fn(),
}));

vi.mock('@/actions/updateViewMode', () => ({
  updateViewMode,
}));

vi.mock('@/actions/setProjectStarred', () => ({
  setProjectStarred,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
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

type StarWriteCall = {
  projectId: string;
  starred: boolean;
  resolve: (value: { data: { starred: boolean } } | { error: string }) => void;
};

function mockStarWrites() {
  const pending: StarWriteCall[] = [];
  const persisted: Array<{ projectId: string; starred: boolean }> = [];
  let inFlight = 0;
  let maxInFlight = 0;

  setProjectStarred.mockImplementation((projectId: string, starred: boolean) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise((resolve) => {
      const write: StarWriteCall = {
        projectId,
        starred,
        resolve: (value) => {
          inFlight -= 1;
          if ('data' in value) {
            persisted.push({ projectId, starred: value.data.starred });
          }
          resolve(value);
        },
      };
      pending.push(write);
    });
  });

  async function resolveAt(
    index: number,
    value: { data: { starred: boolean } } | { error: string },
  ) {
    const write = pending[index];
    await act(async () => {
      write?.resolve(value);
    });
  }

  return {
    pending,
    persisted,
    maxInFlight: () => maxInFlight,
    inFlight: () => inFlight,
    resolveAt,
  };
}

describe('ProjectsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setProjectStarred.mockResolvedValue({ data: { starred: true } });
    refresh.mockReset();
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

  it('does not render the Starred section when no project is starred', () => {
    renderView(<ProjectsView projects={[project, emptyBoard]} />);

    expect(screen.queryByRole('heading', { name: 'Starred' })).not.toBeInTheDocument();
  });

  it('renders the Starred section only for starred projects', () => {
    renderView(<ProjectsView projects={[{ ...project, starred: true }, emptyBoard]} />);

    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Starred' }).nextElementSibling).toHaveTextContent(
      '1',
    );
    expect(screen.getByRole('link', { name: /Sprint board/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Empty board/ })).toBeInTheDocument();
  });

  it('moves a project into Starred when the star is toggled on', async () => {
    const writes = mockStarWrites();
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />);

    expect(screen.queryByRole('heading', { name: 'Starred' })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Star project' })[0]!);

    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();
    expect(setProjectStarred).toHaveBeenCalledWith('project-1', true);

    await writes.resolveAt(0, { data: { starred: true } });
  });

  it('moves a project out of Starred when the star is toggled off', async () => {
    const writes = mockStarWrites();
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[{ ...project, starred: true }, emptyBoard]} />);

    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unstar project' }));

    expect(screen.queryByRole('heading', { name: 'Starred' })).not.toBeInTheDocument();
    expect(setProjectStarred).toHaveBeenCalledWith('project-1', false);

    await writes.resolveAt(0, { data: { starred: false } });
  });

  it('persists only the last intended star when toggled twice quickly', async () => {
    const writes = mockStarWrites();
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />);

    await user.click(screen.getAllByRole('button', { name: 'Star project' })[0]!);
    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unstar project' }));
    expect(screen.queryByRole('heading', { name: 'Starred' })).not.toBeInTheDocument();

    expect(setProjectStarred).toHaveBeenCalledTimes(1);
    expect(setProjectStarred).toHaveBeenCalledWith('project-1', true);
    expect(writes.inFlight()).toBe(1);

    await writes.resolveAt(0, { data: { starred: true } });

    await waitFor(() => {
      expect(setProjectStarred).toHaveBeenCalledTimes(2);
    });
    expect(setProjectStarred).toHaveBeenNthCalledWith(2, 'project-1', false);
    expect(writes.maxInFlight()).toBe(1);

    await writes.resolveAt(1, { data: { starred: false } });

    await waitFor(() => {
      expect(writes.persisted.at(-1)).toEqual({ projectId: 'project-1', starred: false });
    });
    expect(screen.queryByRole('heading', { name: 'Starred' })).not.toBeInTheDocument();
  });

  it('coalesces a rapid triple-toggle to the final intended value', async () => {
    const writes = mockStarWrites();
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />);

    await user.click(screen.getAllByRole('button', { name: 'Star project' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Unstar project' }));
    await user.click(screen.getAllByRole('button', { name: 'Star project' })[0]!);

    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();
    expect(setProjectStarred).toHaveBeenCalledTimes(1);
    expect(setProjectStarred).toHaveBeenCalledWith('project-1', true);

    await writes.resolveAt(0, { data: { starred: true } });

    await act(async () => {
      await Promise.resolve();
    });
    expect(setProjectStarred).toHaveBeenCalledTimes(1);
    expect(writes.persisted).toEqual([{ projectId: 'project-1', starred: true }]);
    expect(writes.maxInFlight()).toBe(1);
  });

  it('never overlaps star writes for the same project', async () => {
    const writes = mockStarWrites();
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />);

    await user.click(screen.getAllByRole('button', { name: 'Star project' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Unstar project' }));
    await user.click(screen.getAllByRole('button', { name: 'Star project' })[0]!);

    expect(writes.inFlight()).toBe(1);

    await writes.resolveAt(0, { data: { starred: true } });
    await act(async () => {
      await Promise.resolve();
    });

    expect(writes.maxInFlight()).toBe(1);
    expect(writes.inFlight()).toBe(0);
  });

  it('does not block star writes on different projects', async () => {
    const writes = mockStarWrites();
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />);

    const [first, second] = screen.getAllByRole('button', { name: 'Star project' });
    await user.click(first!);
    await user.click(second!);

    expect(setProjectStarred).toHaveBeenCalledTimes(2);
    expect(setProjectStarred).toHaveBeenCalledWith('project-1', true);
    expect(setProjectStarred).toHaveBeenCalledWith('project-2', true);
    expect(writes.inFlight()).toBe(2);
    expect(writes.maxInFlight()).toBe(2);

    await writes.resolveAt(0, { data: { starred: true } });
    await writes.resolveAt(1, { data: { starred: true } });
  });

  it('stops the persist loop on error and reconciles to server truth', async () => {
    const writes = mockStarWrites();
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />);

    await user.click(screen.getAllByRole('button', { name: 'Star project' })[0]!);
    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unstar project' }));

    await writes.resolveAt(0, { error: 'Unauthorized' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    });
    expect(setProjectStarred).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Starred' })).not.toBeInTheDocument();
  });

  it('rolls back a single optimistic star when setProjectStarred fails', async () => {
    const writes = mockStarWrites();
    const user = userEvent.setup();
    renderView(<ProjectsView projects={[project, emptyBoard]} />);

    await user.click(screen.getAllByRole('button', { name: 'Star project' })[0]!);
    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unstar project' })).toBeInTheDocument();

    await writes.resolveAt(0, { error: 'Unauthorized' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    });
    expect(setProjectStarred).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Starred' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Star project' }).length).toBeGreaterThan(0);
  });

  it('keeps the Starred section as cards in list view', async () => {
    const user = userEvent.setup();
    renderView(
      <ProjectsView projects={[{ ...project, starred: true }, emptyBoard]} initialView="list" />,
    );

    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();
    expect(screen.getByText('11 of 24 tasks')).toBeInTheDocument();
    expect(screen.getByText('0 tasks')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Grid' }));
    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();
  });

  it('renders recents chips when recents are passed', () => {
    renderView(
      <ProjectsView projects={[project, emptyBoard]} recentProjects={[emptyBoard, project]} />,
    );

    expect(screen.getByText('Recents')).toBeInTheDocument();
    const recents = screen.getByText('Recents').parentElement;
    const chips = recents?.querySelectorAll('a') ?? [];
    expect([...chips].map((chip) => chip.getAttribute('href'))).toEqual([
      '/projects/project-2',
      '/projects/project-1',
    ]);
  });

  it('does not render recents when the list is empty', () => {
    renderView(<ProjectsView projects={[project]} recentProjects={[]} />);

    expect(screen.queryByText('Recents')).not.toBeInTheDocument();
  });
});
