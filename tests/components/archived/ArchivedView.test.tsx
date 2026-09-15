// tests/components/archived/ArchivedView.test.tsx
//
// Tests for the project archived-tasks screen.
//
// Tested:
// - Empty copy when the project has no archived tasks
// - No-results empty state when filters match nothing
// - Phone selection chrome sits above the tab bar via the shared offset token
// - Search, date range, and sort clear the current selection
// - MEMBER restore and delete controls are disabled; export stays available
// - Export opens a CSV/JSON dialog
// - Exporting without opening a card writes description, comments, and subtask text
// - A retained query on a paged list shows matching rows and the matching count
// - A load-more response that arrives after the filter changed is discarded
// - A list response that started before a restore or delete does not reinsert
//   the row or overwrite the count
// - An in-flight query, range, or sort request discarded by restore or delete
//   is restarted after the mutation so the screen does not keep the previous
//   filter's rows and total
// - Restore removes the row, shows Undo only after success, and undo puts it back
// - Undo cannot be triggered while restore is still pending
// - A failed first restore puts its own rows back after a second restore started
// - A failed restore or a successful Undo puts the row back in date order on a
//   paged list
//
// What is covered:
// - Empty states, filter-clears-selection, tab-bar offset on sticky chrome,
//   MEMBER permissions, export dialog, deferred-detail export, retained search
//   on a server-paged list, stale load-more after a filter change, restore undo
//   timing, stale-failure rollback, filter refetch after mutation invalidation
//
// Run with: pnpm test:run tests/components/archived/ArchivedView.test.tsx
//
// SEE: src/components/archived/ArchivedView.tsx

import { useLayoutEffect, type ReactElement, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ArchivedProject, ArchivedTask } from '@/lib/archived';

const restoreArchivedCards = vi.fn();
const rearchiveArchivedCards = vi.fn();
const deleteArchivedCards = vi.fn();
const restoreArchivedProjects = vi.fn();
const rearchiveArchivedProjects = vi.fn();
const deleteArchivedProject = vi.fn();
type ListArchivedCardsResult = { data: { cards: ArchivedTask[]; totalCount: number } };
const listArchivedCards = vi.fn<
  (input?: {
    cursor?: { id: string; title: string; archivedAt: string };
  }) => Promise<ListArchivedCardsResult>
>(async () => ({
  data: { cards: [], totalCount: 0 },
}));
const listArchivedProjects = vi.fn(
  async (): Promise<{ data: { projects: ArchivedProject[]; totalCount: number } }> => ({
    data: { projects: [], totalCount: 0 },
  }),
);
const getArchivedCardDetail = vi.fn(async () => ({ error: 'Unauthorized' as const }));
const getArchivedProjectDetail = vi.fn(async () => ({ error: 'Unauthorized' as const }));
const getArchivedCardsDetail = vi.fn(
  async (): Promise<{ data: Record<string, unknown> } | { error: 'Unauthorized' }> => ({
    error: 'Unauthorized',
  }),
);
const refresh = vi.fn();

vi.mock('@/actions/restoreArchivedCards', () => ({ restoreArchivedCards }));
vi.mock('@/actions/rearchiveArchivedCards', () => ({ rearchiveArchivedCards }));
vi.mock('@/actions/deleteArchivedCards', () => ({ deleteArchivedCards }));
vi.mock('@/actions/restoreArchivedProjects', () => ({ restoreArchivedProjects }));
vi.mock('@/actions/rearchiveArchivedProjects', () => ({ rearchiveArchivedProjects }));
vi.mock('@/actions/deleteArchivedProject', () => ({ deleteArchivedProject }));
vi.mock('@/actions/listArchivedCards', () => ({ listArchivedCards }));
vi.mock('@/actions/listArchivedProjects', () => ({ listArchivedProjects }));
vi.mock('@/actions/getArchivedCardDetail', () => ({ getArchivedCardDetail }));
vi.mock('@/actions/getArchivedProjectDetail', () => ({ getArchivedProjectDetail }));
vi.mock('@/actions/getArchivedCardsDetail', () => ({ getArchivedCardsDetail }));
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

function RetainQuery({ query, children }: { query: string; children: ReactNode }) {
  const { query: current, setQuery } = useProjectsSearch();
  useLayoutEffect(() => {
    if (current !== query) setQuery(query);
  }, [current, query, setQuery]);
  if (current !== query) return null;
  return children;
}

function renderView(ui: ReactElement) {
  return render(ui, { wrapper: Harness });
}

function renderPaged(ui: ReactElement, query: string) {
  return render(ui, {
    wrapper: function PagedHarness({ children }: { children: ReactNode }) {
      return (
        <ProjectsSearchProvider>
          <RetainQuery query={query}>{children}</RetainQuery>
        </ProjectsSearchProvider>
      );
    },
  });
}

function archivedRow(title: string) {
  return screen.getAllByRole('article', { name: title })[0]!;
}

function shownTitleOrder(titles: string[]) {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const article of screen.getAllByRole('article')) {
    const title = titles.find((name) => article.textContent?.includes(name));
    if (!title || seen.has(title)) continue;
    seen.add(title);
    order.push(title);
  }
  return order;
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
      screen.getByRole('heading', { name: 'Archived' }).closest('[data-slot="screen-header"]'),
    ).not.toBeNull();
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

    const sticky = document.querySelector('.sticky');
    expect(sticky).toHaveClass(
      'max-tablet:bottom-[calc(var(--spacing-mobile-tab-bar-clearance)+0.5rem)]',
    );
    expect(sticky).toHaveClass('bottom-2');

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

  it('exports description, comment bodies, authors, and subtask text without opening the card', async () => {
    const user = userEvent.setup();
    const slim: ArchivedTask = {
      ...card,
      description: null,
      comments: [],
      subtasks: [{ id: 's1', done: true }],
      commentCount: 1,
      detailLoaded: false,
    };
    getArchivedCardsDetail.mockResolvedValue({
      data: {
        'card-1': {
          description: 'Cover the board',
          subtasks: [{ id: 's1', text: 'Sketch the nav', done: true, order: 1 }],
          comments: [
            {
              id: 'c1',
              body: 'Keep the icon set.',
              createdAt: new Date('2026-08-08T10:00:00.000Z'),
              editedAt: null,
              author: { id: 'user-grace', name: 'Grace Hopper', username: 'grace' },
            },
          ],
          commentCount: 1,
        },
      },
    });
    const blobs: Blob[] = [];
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((obj) => {
      blobs.push(obj as Blob);
      return 'blob:export';
    });
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[slim]}
        initialTotalCount={1}
        canAdminister
      />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Export' })[0]!);
    await user.click(screen.getByRole('button', { name: 'JSON' }));

    await waitFor(() => {
      expect(getArchivedCardsDetail).toHaveBeenCalledWith({
        projectId: 'project-1',
        cardIds: ['card-1'],
      });
    });
    await waitFor(() => {
      expect(blobs.length).toBe(1);
    });
    const payload = JSON.parse(await blobs[0]!.text()) as {
      tasks: Array<{
        description: string;
        subtasks: Array<{ text: string }>;
        comments: Array<{ body: string; author: { username: string } }>;
      }>;
    };
    expect(payload.tasks[0]?.description).toBe('Cover the board');
    expect(payload.tasks[0]?.subtasks[0]?.text).toBe('Sketch the nav');
    expect(payload.tasks[0]?.comments[0]?.body).toBe('Keep the icon set.');
    expect(payload.tasks[0]?.comments[0]?.author.username).toBe('grace');
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('shows matching rows and the matching count for a retained query on a paged list', async () => {
    listArchivedCards.mockResolvedValue({
      data: { cards: [card], totalCount: 1 },
    });
    renderPaged(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={2}
        canAdminister
      />,
      'Write tests',
    );

    await waitFor(() => {
      expect(listArchivedCards).toHaveBeenCalledWith({
        projectId: 'project-1',
        query: 'Write tests',
        range: 'all',
        sort: 'date',
      });
    });
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ship the grid')).not.toBeInTheDocument();
  });

  it('discards a load-more response that arrives after the filter changed', async () => {
    const user = userEvent.setup();
    const older: ArchivedTask = { ...other, id: 'card-3', title: 'Ancient work', code: 'SB-3' };
    const olderResolves: Array<(value: ListArchivedCardsResult) => void> = [];
    listArchivedCards.mockImplementation(async (input) => {
      if (input?.cursor) {
        return new Promise<ListArchivedCardsResult>((resolve) => {
          olderResolves.push(resolve);
        });
      }
      return { data: { cards: [card], totalCount: 1 } };
    });
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: /View older \(2\)/ }));
    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.queryByText('Ship the grid')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(olderResolves).toHaveLength(1);
    });
    olderResolves[0]!({ data: { cards: [older], totalCount: 99 } });

    await waitFor(() => {
      expect(screen.queryAllByText('Ancient work')).toHaveLength(0);
    });
    expect(screen.getByText('1 archived task')).toBeInTheDocument();
    expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();
  });

  it('does not reinsert a restored row or overwrite the count from a list that started before restore', async () => {
    const user = userEvent.setup();
    const olderResolves: Array<(value: ListArchivedCardsResult) => void> = [];
    listArchivedCards.mockImplementation(async (input) => {
      if (input?.cursor) {
        return new Promise<ListArchivedCardsResult>((resolve) => {
          olderResolves.push(resolve);
        });
      }
      return { data: { cards: [card], totalCount: 1 } };
    });
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: /View older \(2\)/ }));
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getByText('3 archived tasks')).toBeInTheDocument();

    await waitFor(() => {
      expect(olderResolves).toHaveLength(1);
    });
    olderResolves[0]!({ data: { cards: [card], totalCount: 99 } });

    await waitFor(() => {
      expect(screen.queryAllByText('Write tests')).toHaveLength(0);
    });
    expect(screen.getByText('3 archived tasks')).toBeInTheDocument();
    expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();
  });

  it('does not reinsert a deleted row or overwrite the count from a list that started before delete', async () => {
    const user = userEvent.setup();
    const olderResolves: Array<(value: ListArchivedCardsResult) => void> = [];
    listArchivedCards.mockImplementation(async (input) => {
      if (input?.cursor) {
        return new Promise<ListArchivedCardsResult>((resolve) => {
          olderResolves.push(resolve);
        });
      }
      return { data: { cards: [card], totalCount: 1 } };
    });
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: /View older \(2\)/ }));
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Delete permanently' })[0]!,
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Delete/ }));
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getByText('3 archived tasks')).toBeInTheDocument();

    await waitFor(() => {
      expect(olderResolves).toHaveLength(1);
    });
    olderResolves[0]!({ data: { cards: [card], totalCount: 99 } });

    await waitFor(() => {
      expect(screen.queryAllByText('Write tests')).toHaveLength(0);
    });
    expect(screen.getByText('3 archived tasks')).toBeInTheDocument();
    expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();
  });

  it('refetches the current filter after restore discards an in-flight list request', async () => {
    const user = userEvent.setup();
    const firstPageResolves: Array<(value: ListArchivedCardsResult) => void> = [];
    const restoreResolves: Array<(value: { data: { ids: string[]; undoToken: string } }) => void> =
      [];
    listArchivedCards.mockImplementation(async (input) => {
      if (input?.cursor) {
        return { data: { cards: [], totalCount: 0 } };
      }
      if (firstPageResolves.length === 0) {
        return new Promise<ListArchivedCardsResult>((resolve) => {
          firstPageResolves.push(resolve);
        });
      }
      return { data: { cards: [other], totalCount: 1 } };
    });
    restoreArchivedCards.mockImplementation(
      () =>
        new Promise<{ data: { ids: string[]; undoToken: string } }>((resolve) => {
          restoreResolves.push(resolve);
        }),
    );
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(firstPageResolves).toHaveLength(1);
    });
    expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);
    expect(screen.getByText('4 archived tasks')).toBeInTheDocument();

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getByText('3 archived tasks')).toBeInTheDocument();

    firstPageResolves[0]!({ data: { cards: [card], totalCount: 99 } });
    await waitFor(() => {
      expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getByText('3 archived tasks')).toBeInTheDocument();
    expect(listArchivedCards).toHaveBeenCalledTimes(1);

    restoreResolves[0]!({ data: { ids: ['card-1'], undoToken: 'undo-1' } });
    await waitFor(() => {
      expect(listArchivedCards).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.getAllByText('Ship the grid').length).toBeGreaterThan(0);
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
  });

  it('refetches the current filter after delete discards an in-flight list request', async () => {
    const user = userEvent.setup();
    const firstPageResolves: Array<(value: ListArchivedCardsResult) => void> = [];
    const deleteResolves: Array<(value: { data: { ids: string[] } }) => void> = [];
    listArchivedCards.mockImplementation(async (input) => {
      if (input?.cursor) {
        return { data: { cards: [], totalCount: 0 } };
      }
      if (firstPageResolves.length === 0) {
        return new Promise<ListArchivedCardsResult>((resolve) => {
          firstPageResolves.push(resolve);
        });
      }
      return { data: { cards: [other], totalCount: 1 } };
    });
    deleteArchivedCards.mockImplementation(
      () =>
        new Promise<{ data: { ids: string[] } }>((resolve) => {
          deleteResolves.push(resolve);
        }),
    );
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(firstPageResolves).toHaveLength(1);
    });

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Delete permanently' })[0]!,
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Delete/ }));
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getByText('3 archived tasks')).toBeInTheDocument();

    firstPageResolves[0]!({ data: { cards: [card], totalCount: 99 } });
    await waitFor(() => {
      expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();
    });
    expect(listArchivedCards).toHaveBeenCalledTimes(1);

    deleteResolves[0]!({ data: { ids: ['card-1'] } });
    await waitFor(() => {
      expect(listArchivedCards).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.getAllByText('Ship the grid').length).toBeGreaterThan(0);
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
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
      within(archivedRow('Write tests')).getAllByRole('button', {
        name: 'Restore',
      })[0]!,
    );
    await waitFor(() => {
      expect(restoreArchivedCards).toHaveBeenCalledTimes(1);
    });
    await user.click(
      within(archivedRow('Ship the grid')).getAllByRole('button', {
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

  it('puts a failed restore back in date order on a paged list', async () => {
    const user = userEvent.setup();
    restoreArchivedCards.mockResolvedValue({ error: 'Unauthorized' });
    const newest: ArchivedTask = {
      ...card,
      id: 'card-new',
      title: 'Newest',
      code: 'SB-9',
      archivedAt: new Date('2026-08-03T10:00:00.000Z'),
    };
    const middle: ArchivedTask = {
      ...card,
      id: 'card-mid',
      title: 'Middle',
      code: 'SB-8',
      archivedAt: new Date('2026-08-02T10:00:00.000Z'),
    };
    const oldest: ArchivedTask = {
      ...card,
      id: 'card-old',
      title: 'Oldest',
      code: 'SB-7',
      archivedAt: new Date('2026-08-01T10:00:00.000Z'),
    };
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[newest, middle, oldest]}
        initialTotalCount={3}
        canAdminister
      />,
    );

    expect(shownTitleOrder(['Newest', 'Middle', 'Oldest'])).toEqual(['Newest', 'Middle', 'Oldest']);

    await user.click(within(archivedRow('Middle')).getAllByRole('button', { name: 'Restore' })[0]!);

    await waitFor(() => {
      expect(restoreArchivedCards).toHaveBeenCalledWith({
        projectId: 'project-1',
        cardIds: ['card-mid'],
      });
    });
    expect(shownTitleOrder(['Newest', 'Middle', 'Oldest'])).toEqual(['Newest', 'Middle', 'Oldest']);
  });

  it('puts an undone restore back in date order on a paged list', async () => {
    const user = userEvent.setup();
    restoreArchivedCards.mockResolvedValue({ data: { ids: ['card-mid'], undoToken: 'undo-mid' } });
    rearchiveArchivedCards.mockResolvedValue({ data: { ids: ['card-mid'] } });
    const newest: ArchivedTask = {
      ...card,
      id: 'card-new',
      title: 'Newest',
      code: 'SB-9',
      archivedAt: new Date('2026-08-03T10:00:00.000Z'),
    };
    const middle: ArchivedTask = {
      ...card,
      id: 'card-mid',
      title: 'Middle',
      code: 'SB-8',
      archivedAt: new Date('2026-08-02T10:00:00.000Z'),
    };
    const oldest: ArchivedTask = {
      ...card,
      id: 'card-old',
      title: 'Oldest',
      code: 'SB-7',
      archivedAt: new Date('2026-08-01T10:00:00.000Z'),
    };
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[newest, middle, oldest]}
        initialTotalCount={3}
        canAdminister
      />,
    );

    await user.click(within(archivedRow('Middle')).getAllByRole('button', { name: 'Restore' })[0]!);
    await waitFor(() => {
      expect(screen.queryByRole('article', { name: 'Middle' })).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(rearchiveArchivedCards).toHaveBeenCalledWith({ token: 'undo-mid' });
    });
    expect(shownTitleOrder(['Newest', 'Middle', 'Oldest'])).toEqual(['Newest', 'Middle', 'Oldest']);
  });
});

const archivedProject: ArchivedProject = {
  id: 'project-1',
  title: 'Sprint board',
  description: 'Ship the board',
  status: 'IN_PROGRESS',
  statusLabel: 'In progress',
  taskCount: 2,
  doneCount: 1,
  percent: 50,
  ownerName: 'Ada Lovelace',
  members: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
  columns: [{ id: 'col-todo', title: 'To do', cardCount: 2 }],
  archivedAt: now,
  archivedBy: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
  canAdminister: true,
};

describe('ArchivedView projects scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreArchivedProjects.mockResolvedValue({
      data: { ids: ['project-1'], undoToken: 'undo-project' },
    });
    rearchiveArchivedProjects.mockResolvedValue({ data: { ids: ['project-1'] } });
    deleteArchivedProject.mockResolvedValue({ data: { id: 'project-1' } });
  });

  it('shows archived-projects empty copy', () => {
    renderView(<ArchivedView initialProjects={[]} />);

    expect(screen.getByText('No archived projects')).toBeInTheDocument();
    expect(
      screen.getByText(
        'When you archive a project from its board it will show up here, with its history intact.',
      ),
    ).toBeInTheDocument();
  });

  it('hides export and batch delete', () => {
    renderView(<ArchivedView initialProjects={[archivedProject]} />);

    expect(screen.queryAllByRole('button', { name: 'Export' })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Delete permanently' }).length).toBeGreaterThan(0);
  });

  it('keeps restore and delete disabled for a member of that project', () => {
    renderView(<ArchivedView initialProjects={[{ ...archivedProject, canAdminister: false }]} />);

    for (const button of screen.getAllByRole('button', { name: 'Restore' })) {
      expect(button).toBeDisabled();
    }
    for (const button of screen.getAllByRole('button', { name: 'Delete permanently' })) {
      expect(button).toBeDisabled();
    }
  });

  it('requires typing the project title before permanent delete', async () => {
    const user = userEvent.setup();
    renderView(<ArchivedView initialProjects={[archivedProject]} />);

    await user.click(screen.getAllByRole('button', { name: 'Delete permanently' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Delete this project?' }),
    ).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: /Delete/ });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByPlaceholderText('Project title'), 'Sprint board');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => {
      expect(deleteArchivedProject).toHaveBeenCalledWith({
        projectId: 'project-1',
        title: 'Sprint board',
      });
    });
  });
});
