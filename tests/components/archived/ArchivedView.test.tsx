// tests/components/archived/ArchivedView.test.tsx
//
// Tests for the project archived-tasks screen.
//
// Tested:
// - Empty copy when the project has no archived tasks
// - No-results empty state when filters match nothing
// - Search, date range, and sort clear the current selection
// - MEMBER restore and delete controls are disabled; export stays available
// - Export opens a CSV/JSON dialog
// - Restore removes the row, shows Undo only after success, and undo puts it back
// - Undo cannot be triggered while restore is still pending
// - A failed first restore puts its own rows back after a second restore started
//
// What is covered:
// - Empty states, filter-clears-selection, MEMBER permissions, export dialog,
//   restore undo timing, stale-failure rollback
//
// Run with: pnpm test:run tests/components/archived/ArchivedView.test.tsx
//
// SEE: src/components/archived/ArchivedView.tsx

import { type ReactElement, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ArchivedTask } from '@/lib/archived';

const restoreArchivedCards = vi.fn();
const rearchiveArchivedCards = vi.fn();
const deleteArchivedCards = vi.fn();
const refresh = vi.fn();

vi.mock('@/actions/restoreArchivedCards', () => ({ restoreArchivedCards }));
vi.mock('@/actions/rearchiveArchivedCards', () => ({ rearchiveArchivedCards }));
vi.mock('@/actions/deleteArchivedCards', () => ({ deleteArchivedCards }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const { default: ArchivedView } = await import('@/components/archived/ArchivedView');
const { ProjectsSearchProvider, useProjectsSearch } =
  await import('@/components/projects/ProjectsSearch');

const now = new Date();

const card: ArchivedTask = {
  id: 'card-1',
  title: 'Write tests',
  code: 'SB-1',
  description: null,
  archivedAt: now,
  archivedBy: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
  column: { id: 'col-todo', title: 'To do' },
  label: { id: 'label-design', name: 'Design', tone: 'blue' },
  assignees: [],
  subtasks: [],
  comments: [],
};

const other: ArchivedTask = {
  ...card,
  id: 'card-2',
  title: 'Ship the grid',
  code: 'SB-2',
};

function SearchSeed({ query }: { query: string }) {
  const { setQuery } = useProjectsSearch();
  return (
    <button type="button" onClick={() => setQuery(query)}>
      Seed search
    </button>
  );
}

function Harness({ children }: { children: ReactNode }) {
  return (
    <ProjectsSearchProvider>
      <SearchSeed query="zzzz" />
      {children}
    </ProjectsSearchProvider>
  );
}

function renderView(ui: ReactElement) {
  return render(ui, { wrapper: Harness });
}

describe('ArchivedView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreArchivedCards.mockResolvedValue({ data: { ids: ['card-1'], undoToken: 'undo-1' } });
    rearchiveArchivedCards.mockResolvedValue({ data: { ids: ['card-1'] } });
    deleteArchivedCards.mockResolvedValue({ data: { ids: ['card-1'] } });
  });

  it('shows empty copy when the project has no archived tasks', () => {
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[]}
        canAdminister
      />,
    );

    expect(screen.getByText('No archived tasks in Sprint board')).toBeInTheDocument();
    expect(
      screen.getByText('Archive a card from the board and you will find it here.'),
    ).toBeInTheDocument();
  });

  it('shows a no-results empty state when filters match nothing', async () => {
    const user = userEvent.setup();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card]}
        canAdminister
      />,
    );

    await user.type(screen.getByLabelText('Search archived tasks'), 'zzzz');

    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(
      screen.getByText('No archived item matches the search and date range.'),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);
  });

  it('clears selection when search, date range, or sort changes', async () => {
    const user = userEvent.setup();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        canAdminister
      />,
    );

    await user.click(screen.getAllByLabelText('Select Write tests')[0]!);
    expect(screen.getAllByText('1 task selected').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    expect(screen.queryByText('1 task selected')).not.toBeInTheDocument();

    await user.click(screen.getAllByLabelText('Select Write tests')[0]!);
    await user.click(screen.getByRole('button', { name: 'Sort: Archive date' }));
    expect(screen.queryByText('1 task selected')).not.toBeInTheDocument();

    await user.click(screen.getAllByLabelText('Select Write tests')[0]!);
    await user.click(screen.getByRole('button', { name: 'Seed search' }));
    expect(screen.queryByText('1 task selected')).not.toBeInTheDocument();
  });

  it('disables restore and delete for a member and still allows export', async () => {
    const user = userEvent.setup();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card]}
        canAdminister={false}
      />,
    );

    for (const button of screen.getAllByRole('button', { name: 'Restore' })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute(
        'title',
        'Only owners and admins can restore or delete archived tasks.',
      );
    }
    for (const button of screen.getAllByRole('button', { name: 'Delete permanently' })) {
      expect(button).toBeDisabled();
    }

    await user.click(screen.getAllByRole('button', { name: 'Export' })[0]!);
    expect(await screen.findByRole('heading', { name: 'Export as' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'JSON' })).toBeEnabled();
  });

  it('restores a task and undoes from the toast', async () => {
    const user = userEvent.setup();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card]}
        canAdminister
      />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Restore' })[0]!);

    await waitFor(() => {
      expect(restoreArchivedCards).toHaveBeenCalledWith({
        projectId: 'project-1',
        cardIds: ['card-1'],
      });
    });
    expect(screen.getByRole('status')).toHaveTextContent('"Write tests" restored');
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(rearchiveArchivedCards).toHaveBeenCalledWith({
        token: 'undo-1',
      });
    });
    expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);
  });

  it('does not offer Undo until restore has succeeded', async () => {
    const user = userEvent.setup();
    let finishRestore: (value: { data: { ids: string[]; undoToken: string } }) => void = () => {};
    restoreArchivedCards.mockImplementation(
      () =>
        new Promise<{ data: { ids: string[]; undoToken: string } }>((resolve) => {
          finishRestore = resolve;
        }),
    );
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card]}
        canAdminister
      />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Restore' })[0]!);

    await waitFor(() => {
      expect(restoreArchivedCards).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();

    finishRestore({ data: { ids: ['card-1'], undoToken: 'undo-1' } });

    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('"Write tests" restored');
  });

  it('rolls a failed first restore back after a second restore has started', async () => {
    const user = userEvent.setup();
    const pending: Array<
      (value: { data: { ids: string[]; undoToken: string } } | { error: string }) => void
    > = [];
    restoreArchivedCards.mockImplementation(
      () =>
        new Promise<{ data: { ids: string[]; undoToken: string } } | { error: string }>(
          (resolve) => {
            pending.push(resolve);
          },
        ),
    );
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        canAdminister
      />,
    );

    await user.click(
      within(screen.getAllByRole('button', { name: /Write tests/ })[0]!).getAllByRole('button', {
        name: 'Restore',
      })[0]!,
    );
    await waitFor(() => {
      expect(restoreArchivedCards).toHaveBeenCalledTimes(1);
    });
    await user.click(
      within(screen.getAllByRole('button', { name: /Ship the grid/ })[0]!).getAllByRole('button', {
        name: 'Restore',
      })[0]!,
    );
    await waitFor(() => {
      expect(restoreArchivedCards).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.queryByText('Ship the grid')).not.toBeInTheDocument();

    pending[1]!({ data: { ids: ['card-2'], undoToken: 'undo-2' } });
    pending[0]!({ error: 'Unauthorized' });

    await waitFor(() => {
      expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Ship the grid')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized');
  });
});
