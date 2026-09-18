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
// - After a filter change and before the first page, leftover rows and the count
//   are dimmed and inert, View older is absent, and no empty state is shown
// - Load more clicked before a filter change is discarded whether it arrives
//   before or after the new first page; rows, count, and View older match the
//   new filter
// - A first page for a previous filter that resolves late changes nothing
// - No results appears only after the server responds for the current filter
// - A filter change closes open detail and resets swipe
// - Selection, open, swipe, and row actions do nothing while pending
// - A failed first page shows an inline error and Retry; retry loads the current
//   filter and the list becomes live (error result and rejected promise)
// - A load-more response that arrives after the filter changed is discarded
// - A list response that started before a restore or delete keeps its rows;
//   an ambiguous count is corrected by count-only, and the row stays hidden
// - Undo during a pending filter change does not discard or restart the first page
// - Restore hides the row, shows Undo only after success, and undo puts it back
// - Undo cannot be triggered while restore is still pending
// - A failed first restore puts its own rows back after a second restore started
// - A failed restore or a successful Undo puts the row back in date order on a
//   paged list
// - Count-only totalCount is not subtracted again by leftover lastPageIds
// - An older count-only response does not overwrite a newer totalCount
// - Hiding a row while count-only is in flight converges without user action
// - A load more that finishes after a newer count-only still advances the cursor
// - Unhiding after a count that excluded the row refreshes the subtitle (failure,
//   in-flight count, and Undo)
// - A rejected count-only falls back to a first-page refresh
// - An obsolete count-only releases its in-flight key for a later correction
// - An oversized hidden set does not start repeated count or list requests
// - Load more follows hasMore from the response, not totalCount, sends the
//   server cursor, and stops after hasMore is false (cards and projects)
// - A second click while load more is pending does not reuse the same cursor
//
// What is covered:
// - Empty states, filter-clears-selection, tab-bar offset on sticky chrome,
//   MEMBER permissions, export dialog, deferred-detail export, retained search
//   on a server-paged list, pending leftover list bound to its filter, stale
//   first page and load more, first-page error retry, restore undo timing,
//   stale-failure rollback, hidden-id list/count apply, in-flight load more
//
// Run with: pnpm test:run tests/components/archived/ArchivedView.test.tsx
//
// SEE: src/components/archived/ArchivedView.tsx

import { useLayoutEffect, type ReactElement, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ArchivedProject, ArchivedTask } from '@/lib/archived';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { MAX_ARCHIVED_BATCH } from '@/lib/validation/archived';

const restoreArchivedCards = vi.fn();
const rearchiveArchivedCards = vi.fn();
const deleteArchivedCards = vi.fn();
const restoreArchivedProjects = vi.fn();
const rearchiveArchivedProjects = vi.fn();
const deleteArchivedProject = vi.fn();
type ListArchivedCardsInput = {
  projectId?: string;
  query?: string;
  range?: string;
  sort?: string;
  cursor?: string;
  excludeIds?: string[];
};
type ListArchivedCardsResult =
  | {
      data: {
        cards: ArchivedTask[];
        totalCount: number;
        hasMore: boolean;
        nextCursor: string | null;
      };
    }
  | { error: string };
type ListArchivedProjectsInput = {
  query?: string;
  range?: string;
  sort?: string;
  cursor?: string;
  excludeIds?: string[];
};
type ListArchivedProjectsResult =
  | {
      data: {
        projects: ArchivedProject[];
        totalCount: number;
        hasMore: boolean;
        nextCursor: string | null;
      };
    }
  | { error: string };
type CountArchivedResult =
  { data: { totalCount: number; excludeIds: string[] } } | { error: string };
type Held<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};
const listArchivedCards = vi.fn<
  (input?: ListArchivedCardsInput) => Promise<ListArchivedCardsResult>
>(async () => ({
  data: { cards: [], totalCount: 0, hasMore: false, nextCursor: null },
}));
const listArchivedProjects = vi.fn<
  (input?: ListArchivedProjectsInput) => Promise<ListArchivedProjectsResult>
>(async () => ({
  data: { projects: [], totalCount: 0, hasMore: false, nextCursor: null },
}));
const countArchivedCards = vi.fn<
  (input?: {
    projectId?: string;
    query?: string;
    range?: string;
    excludeIds?: string[];
  }) => Promise<CountArchivedResult>
>(async (input) => ({
  data: { totalCount: 0, excludeIds: input?.excludeIds ?? [] },
}));
const countArchivedProjects = vi.fn<
  (input?: {
    query?: string;
    range?: string;
    excludeIds?: string[];
  }) => Promise<CountArchivedResult>
>(async (input) => ({
  data: { totalCount: 0, excludeIds: input?.excludeIds ?? [] },
}));
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
vi.mock('@/actions/countArchivedCards', () => ({ countArchivedCards }));
vi.mock('@/actions/countArchivedProjects', () => ({ countArchivedProjects }));
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

const later: ArchivedTask = {
  ...card,
  id: 'card-3',
  title: 'Later task',
  code: 'SB-3',
};

const oldest: ArchivedTask = {
  ...card,
  id: 'card-4',
  title: 'Oldest task',
  code: 'SB-4',
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

function holdCardPages() {
  const first: Held<ListArchivedCardsResult>[] = [];
  const older: Held<ListArchivedCardsResult>[] = [];
  listArchivedCards.mockImplementation(async (input) => {
    if (input?.cursor) {
      return new Promise<ListArchivedCardsResult>((resolve, reject) => {
        older.push({ resolve, reject });
      });
    }
    return new Promise<ListArchivedCardsResult>((resolve, reject) => {
      first.push({ resolve, reject });
    });
  });
  return { first, older };
}

function holdCountCards() {
  const held: Held<CountArchivedResult>[] = [];
  countArchivedCards.mockImplementation(
    async () =>
      new Promise<CountArchivedResult>((resolve, reject) => {
        held.push({ resolve, reject });
      }),
  );
  return held;
}

function holdCountProjects() {
  const held: Held<CountArchivedResult>[] = [];
  countArchivedProjects.mockImplementation(
    async () =>
      new Promise<CountArchivedResult>((resolve, reject) => {
        held.push({ resolve, reject });
      }),
  );
  return held;
}

function holdProjectPages() {
  const first: Held<ListArchivedProjectsResult>[] = [];
  const older: Held<ListArchivedProjectsResult>[] = [];
  listArchivedProjects.mockImplementation(async (input) => {
    if (input?.cursor) {
      return new Promise<ListArchivedProjectsResult>((resolve, reject) => {
        older.push({ resolve, reject });
      });
    }
    return new Promise<ListArchivedProjectsResult>((resolve, reject) => {
      first.push({ resolve, reject });
    });
  });
  return { first, older };
}

function expectPendingArchivedList(countLabel: string, rowTitle: string) {
  const count = screen.getByText(countLabel);
  expect(count.closest('[aria-busy="true"]')).not.toBeNull();
  expect(count.closest('.opacity-60')).not.toBeNull();
  expect(archivedRow(rowTitle).closest('.opacity-60')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
  expect(screen.queryByText('No results')).not.toBeInTheDocument();
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
        initialTotalCount={0}
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
    listArchivedCards.mockImplementation(async (input) => ({
      data: {
        cards: input?.query ? [] : [card],
        totalCount: input?.query ? 0 : 1,
        hasMore: false,
        nextCursor: null,
      },
    }));
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card]}
        initialTotalCount={1}
        canAdminister
      />,
    );

    await user.type(screen.getByLabelText('Search archived tasks'), 'zzzz');

    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(
      screen.getByText('No archived item matches the search and date range.'),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect((await screen.findAllByText('Write tests')).length).toBeGreaterThan(0);
  });

  it('clears selection when search, date range, or sort changes', async () => {
    const user = userEvent.setup();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        canAdminister
        initialTotalCount={2}
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
        initialTotalCount={1}
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
      data: { cards: [card], totalCount: 1, hasMore: false, nextCursor: null },
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
        excludeIds: [],
      });
    });
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ship the grid')).not.toBeInTheDocument();
  });

  it('dims leftover rows and the count after a filter change until the first page arrives', async () => {
    const user = userEvent.setup();
    const { first } = holdCardPages();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    expectPendingArchivedList('4 archived tasks', 'Write tests');
    expect(screen.getAllByText('Ship the grid').length).toBeGreaterThan(0);

    first[0]!.resolve({
      data: { cards: [card], totalCount: 1, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.getByText('1 archived task').closest('[aria-busy="true"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
  });

  it('does not select, open, swipe, or restore leftover rows while the new filter is pending', async () => {
    const user = userEvent.setup();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    holdCardPages();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(listArchivedCards).toHaveBeenCalled();
    });
    expectPendingArchivedList('4 archived tasks', 'Write tests');

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    expect(restoreArchivedCards).not.toHaveBeenCalled();
    await user.click(within(archivedRow('Write tests')).getByLabelText('Select Write tests'));
    expect(screen.queryByText('1 task selected')).not.toBeInTheDocument();
    await user.click(archivedRow('Write tests'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.pointerDown(archivedRow('Write tests'), { pointerId: 1, clientX: 40, clientY: 10 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 120, clientY: 10 });
    expect(archivedRow('Write tests')).toHaveStyle({ transform: 'none' });
  });

  it('closes open detail and resets swipe when the filter changes', async () => {
    const user = userEvent.setup();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    holdCardPages();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        canAdminister
      />,
    );

    await user.click(archivedRow('Write tests'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.pointerDown(archivedRow('Write tests'), { pointerId: 1, clientX: 40, clientY: 10 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 100, clientY: 10 });
    expect(archivedRow('Write tests')).toHaveStyle({ transform: 'translateX(60px)' });

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(archivedRow('Write tests')).toHaveStyle({ transform: 'none' });
  });

  it('shows No results only after the current filter first page is empty', async () => {
    const user = userEvent.setup();
    const { first } = holdCardPages();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[]}
        initialTotalCount={0}
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
    expect(screen.getByText('0 archived tasks').closest('[aria-busy="true"]')).not.toBeNull();

    first[0]!.resolve({
      data: { cards: [], totalCount: 0, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(
      screen.getByText('No archived item matches the search and date range.'),
    ).toBeInTheDocument();
  });

  it('ignores a previous-filter first page that resolves after a later filter change', async () => {
    const user = userEvent.setup();
    const pages: Array<{ range?: string; held: Held<ListArchivedCardsResult> }> = [];
    listArchivedCards.mockImplementation(async (input) => {
      return new Promise<ListArchivedCardsResult>((resolve, reject) => {
        pages.push({ range: input?.range, held: { resolve, reject } });
      });
    });
    const seven: ArchivedTask = { ...card, id: 'card-7', title: 'Seven only', code: 'SB-7' };
    const thirty: ArchivedTask = { ...card, id: 'card-30', title: 'Thirty only', code: 'SB-30' };
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
    await user.click(screen.getByRole('button', { name: /Last 30 days/ }));
    await waitFor(() => {
      expect(pages.map((page) => page.range)).toEqual(['7', '30']);
    });

    pages[0]!.held.resolve({
      data: { cards: [seven], totalCount: 99, hasMore: true, nextCursor: 'stale-7' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Seven only')).not.toBeInTheDocument();
    });
    expectPendingArchivedList('4 archived tasks', 'Write tests');
    expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();

    pages[1]!.held.resolve({
      data: { cards: [thirty], totalCount: 2, hasMore: false, nextCursor: null },
    });
    expect(await screen.findAllByText('Thirty only')).not.toHaveLength(0);
    expect(screen.getByText('2 archived tasks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
  });

  it('discards a load-more response that arrives after the new first page', async () => {
    const user = userEvent.setup();
    const older: ArchivedTask = { ...other, id: 'card-3', title: 'Ancient work', code: 'SB-3' };
    const { first, older: olderPages } = holdCardPages();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
      expect(olderPages).toHaveLength(1);
    });
    expectPendingArchivedList('4 archived tasks', 'Write tests');

    first[0]!.resolve({
      data: { cards: [card], totalCount: 1, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.queryByText('Ship the grid')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();

    olderPages[0]!.resolve({
      data: { cards: [older], totalCount: 99, hasMore: true, nextCursor: 'cursor-stale' },
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Ancient work')).toHaveLength(0);
    });
    expect(screen.getByText('1 archived task')).toBeInTheDocument();
    expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
  });

  it('discards a load-more response that arrives before the new first page', async () => {
    const user = userEvent.setup();
    const older: ArchivedTask = { ...other, id: 'card-3', title: 'Ancient work', code: 'SB-3' };
    const { first, older: olderPages } = holdCardPages();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
      expect(olderPages).toHaveLength(1);
    });

    olderPages[0]!.resolve({
      data: { cards: [older], totalCount: 99, hasMore: true, nextCursor: 'cursor-stale' },
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Ancient work')).toHaveLength(0);
    });
    expectPendingArchivedList('4 archived tasks', 'Write tests');
    expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();

    first[0]!.resolve({
      data: { cards: [card], totalCount: 1, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.queryByText('Ship the grid')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
  });

  it('shows a retry control when the first page returns an error and retry loads the current filter', async () => {
    const user = userEvent.setup();
    const first: Held<ListArchivedCardsResult>[] = [];
    listArchivedCards.mockImplementation(async (input) => {
      if (input?.cursor) {
        return { data: { cards: [], totalCount: 0, hasMore: false, nextCursor: null } };
      }
      if (first.length === 0) {
        return new Promise<ListArchivedCardsResult>((resolve, reject) => {
          first.push({ resolve, reject });
        });
      }
      return { data: { cards: [other], totalCount: 1, hasMore: false, nextCursor: null } };
    });
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    first[0]!.resolve({ error: 'Unauthorized' });
    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expectPendingArchivedList('4 archived tasks', 'Write tests');
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    expect(restoreArchivedCards).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.getAllByText('Ship the grid').length).toBeGreaterThan(0);
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('1 archived task').closest('[aria-busy="true"]')).toBeNull();
  });

  it('keeps View older rows and corrects the count after a load more that started before restore', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getByText('9 archived tasks')).toBeInTheDocument();

    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 9, hasMore: false, nextCursor: null },
    });

    expect(await screen.findAllByText('Later task')).not.toHaveLength(0);
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    expect(countArchivedCards).toHaveBeenCalledWith({
      projectId: 'project-1',
      query: '',
      range: 'all',
      excludeIds: ['card-1'],
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['card-1'] } });
    expect(await screen.findByText('9 archived tasks')).toBeInTheDocument();
    expect(screen.getAllByText('Later task').length).toBeGreaterThan(0);
    expect(countArchivedCards).toHaveBeenCalledTimes(1);
  });

  it('corrects the count via count-only when a load more that started before restore reads before commit', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: false, nextCursor: null },
    });

    expect(await screen.findAllByText('Later task')).not.toHaveLength(0);
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['card-1'] } });
    expect(await screen.findByText('9 archived tasks')).toBeInTheDocument();
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getAllByText('Later task').length).toBeGreaterThan(0);
  });

  it('keeps View older rows and corrects the count after a load more that started before delete', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Delete permanently' })[0]!,
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Delete/ }));
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getByText('9 archived tasks')).toBeInTheDocument();

    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: false, nextCursor: null },
    });

    expect(await screen.findAllByText('Later task')).not.toHaveLength(0);
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['card-1'] } });
    expect(await screen.findByText('9 archived tasks')).toBeInTheDocument();
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getAllByText('Later task').length).toBeGreaterThan(0);
  });

  it('keeps an optimistic restore on leftover rows while the new filter is pending', async () => {
    const user = userEvent.setup();
    const { first } = holdCardPages();
    const restoreResolves: Array<(value: { data: { ids: string[]; undoToken: string } }) => void> =
      [];
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

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getByText('3 archived tasks')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    expectPendingArchivedList('3 archived tasks', 'Ship the grid');
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    restoreResolves[0]!({ data: { ids: ['card-1'], undoToken: 'undo-1' } });
  });

  it('replaces a too-narrow first page after Undo unhides during a pending filter change', async () => {
    const user = userEvent.setup();
    const { first } = holdCardPages();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={4}
        canAdminister
      />,
    );

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    expectPendingArchivedList('3 archived tasks', 'Ship the grid');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    first[0]!.resolve({
      data: { cards: [card], totalCount: 99, hasMore: false, nextCursor: null },
    });
    await waitFor(() => {
      expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(first).toHaveLength(2);
    });
    first[1]!.resolve({
      data: { cards: [other], totalCount: 1, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('1 archived task')).toBeInTheDocument();
    expect(screen.getAllByText('Ship the grid').length).toBeGreaterThan(0);
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
  });

  it('keeps an optimistic delete on leftover rows while the new filter is pending', async () => {
    const user = userEvent.setup();
    const { first } = holdCardPages();
    const deleteResolves: Array<(value: { data: { ids: string[] } }) => void> = [];
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

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Delete permanently' })[0]!,
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Delete/ }));
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.getByText('3 archived tasks')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    expectPendingArchivedList('3 archived tasks', 'Ship the grid');
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    deleteResolves[0]!({ data: { ids: ['card-1'] } });
  });

  it('does not subtract leftover lastPageIds after a count-only writer', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [other], totalCount: 9, hasMore: false, nextCursor: null },
    });
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    expect(countArchivedCards).toHaveBeenCalledWith({
      projectId: 'project-1',
      query: '',
      range: 'all',
      excludeIds: ['card-1'],
    });

    await user.click(
      within(archivedRow('Ship the grid')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    counts[0]!.resolve({ data: { totalCount: 8, excludeIds: ['card-1'] } });
    expect(await screen.findByText('8 archived tasks')).toBeInTheDocument();
    expect(screen.queryByText('7 archived tasks')).not.toBeInTheDocument();
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.queryByText('Ship the grid')).not.toBeInTheDocument();
  });

  it('does not let an older count-only response overwrite a newer totalCount', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: false, nextCursor: null },
    });
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });

    await user.click(
      within(archivedRow('Ship the grid')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(2);
    });
    counts[1]!.resolve({ data: { totalCount: 8, excludeIds: ['card-1', 'card-2'] } });
    expect(await screen.findByText('8 archived tasks')).toBeInTheDocument();
    counts[0]!.resolve({ data: { totalCount: 99, excludeIds: ['card-1'] } });
    await waitFor(() => {
      expect(screen.getByText('8 archived tasks')).toBeInTheDocument();
    });
    expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();
    expect(countArchivedCards).toHaveBeenCalledTimes(2);
  });

  it('converges after hiding a row while a count-only request is in flight', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: false, nextCursor: null },
    });
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });

    await user.click(
      within(archivedRow('Ship the grid')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(2);
    });
    counts[0]!.resolve({ data: { totalCount: 8, excludeIds: ['card-1'] } });
    counts[1]!.resolve({ data: { totalCount: 8, excludeIds: ['card-1', 'card-2'] } });
    expect(await screen.findByText('8 archived tasks')).toBeInTheDocument();
    expect(screen.getAllByText('Later task').length).toBeGreaterThan(0);
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(screen.queryByText('Ship the grid')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(countArchivedCards).toHaveBeenCalledTimes(2);
    });
    expect(listArchivedCards.mock.calls.filter((call) => call[0]?.cursor).length).toBe(1);
  });

  it('advances the View older cursor when load more finishes after a newer count-only', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: true, nextCursor: 'cursor-page-2' },
    });
    expect(await screen.findAllByText('Later task')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(2);
    });
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['card-1'] } });
    expect(await screen.findByText('9 archived tasks')).toBeInTheDocument();

    older[1]!.resolve({
      data: { cards: [oldest], totalCount: 99, hasMore: true, nextCursor: 'cursor-page-3' },
    });
    expect(await screen.findAllByText('Oldest task')).not.toHaveLength(0);
    expect(screen.getByText('9 archived tasks')).toBeInTheDocument();
    expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(listArchivedCards.mock.calls.some((call) => call[0]?.cursor === 'cursor-page-3')).toBe(
        true,
      );
    });
  });

  it('refreshes the count after a failed restore whose count-only had excluded the row', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    const restoreResolves: Array<(value: { error: string }) => void> = [];
    restoreArchivedCards.mockImplementation(
      () =>
        new Promise<{ error: string }>((resolve) => {
          restoreResolves.push(resolve);
        }),
    );
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: false, nextCursor: null },
    });
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['card-1'] } });
    expect(await screen.findByText('9 archived tasks')).toBeInTheDocument();

    restoreResolves[0]!({ error: 'Unauthorized' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Unauthorized');
    expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(counts).toHaveLength(2);
    });
    expect(countArchivedCards).toHaveBeenLastCalledWith({
      projectId: 'project-1',
      query: '',
      range: 'all',
      excludeIds: [],
    });
    counts[1]!.resolve({ data: { totalCount: 10, excludeIds: [] } });
    expect(await screen.findByText('10 archived tasks')).toBeInTheDocument();
  });

  it('ignores a count-only that excluded a row unhidden while it was in flight', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    const restoreResolves: Array<(value: { error: string }) => void> = [];
    restoreArchivedCards.mockImplementation(
      () =>
        new Promise<{ error: string }>((resolve) => {
          restoreResolves.push(resolve);
        }),
    );
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: false, nextCursor: null },
    });
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    restoreResolves[0]!({ error: 'Unauthorized' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Unauthorized');
    expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);

    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['card-1'] } });
    await waitFor(() => {
      expect(screen.getByText('10 archived tasks')).toBeInTheDocument();
    });
    expect(screen.queryByText('9 archived tasks')).not.toBeInTheDocument();
  });

  it('refreshes the count after Undo unhides a row excluded by count-only', async () => {
    const user = userEvent.setup();
    const { older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: false, nextCursor: null },
    });
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['card-1'] } });
    expect(await screen.findByText('9 archived tasks')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(rearchiveArchivedCards).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(counts).toHaveLength(2);
    });
    expect(countArchivedCards).toHaveBeenLastCalledWith({
      projectId: 'project-1',
      query: '',
      range: 'all',
      excludeIds: [],
    });
    counts[1]!.resolve({ data: { totalCount: 10, excludeIds: [] } });
    expect(await screen.findByText('10 archived tasks')).toBeInTheDocument();
  });

  it('falls back to a first-page refresh when a corrective count rejects', async () => {
    const user = userEvent.setup();
    const { first, older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: false, nextCursor: null },
    });
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });

    counts[0]!.reject(new Error('count failed'));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    first[0]!.resolve({
      data: { cards: [other, later], totalCount: 9, hasMore: false, nextCursor: null },
    });

    expect(await screen.findByText('9 archived tasks')).toBeInTheDocument();
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
  });

  it('releases an obsolete count key so a later forced correction can run', async () => {
    const user = userEvent.setup();
    const { first, older } = holdCardPages();
    const counts = holdCountCards();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { cards: [later], totalCount: 10, hasMore: false, nextCursor: null },
    });
    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['card-1'] } });
    expect(await screen.findByText('9 archived tasks')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(counts).toHaveLength(2);
    });
    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    first[0]!.resolve({
      data: { cards: [card, other], totalCount: 10, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('10 archived tasks')).toBeInTheDocument();
    counts[1]!.resolve({ data: { totalCount: 10, excludeIds: [] } });

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(counts).toHaveLength(3);
    });
    expect(countArchivedCards).toHaveBeenLastCalledWith({
      projectId: 'project-1',
      query: '',
      range: '7',
      excludeIds: [],
    });
  });

  it('does not start repeated count or list requests for an oversized hidden set', async () => {
    const user = userEvent.setup();
    const extras = Array.from({ length: MAX_ARCHIVED_BATCH }, (_, index) => ({
      ...card,
      id: `extra-${String(index).padStart(3, '0')}`,
      title: `Extra ${index}`,
      code: `SB-E${index}`,
    }));
    const many = [card, ...extras];
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={many}
        initialTotalCount={many.length}
        canAdminister
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    const selected = screen.getAllByText('201 tasks selected')[0]!;
    await user.click(within(selected.closest('div')!).getByRole('button', { name: 'Restore' }));
    await waitFor(() => {
      expect(restoreArchivedCards).toHaveBeenCalledTimes(1);
    });
    expect(restoreArchivedCards.mock.calls[0]?.[0]?.cardIds).toHaveLength(201);
    expect(countArchivedCards).not.toHaveBeenCalled();
    expect(listArchivedCards).not.toHaveBeenCalled();
  });

  it('replaces a too-narrow first page after a failed restore and does not insert the row', async () => {
    const user = userEvent.setup();
    const { first } = holdCardPages();
    const restoreResolves: Array<(value: { error: string }) => void> = [];
    restoreArchivedCards.mockImplementation(
      () =>
        new Promise<{ error: string }>((resolve) => {
          restoreResolves.push(resolve);
        }),
    );
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        canAdminister
      />,
    );

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    restoreResolves[0]!({ error: 'Unauthorized' });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized');
    });
    first[0]!.resolve({
      data: { cards: [other], totalCount: 99, hasMore: false, nextCursor: null },
    });
    await waitFor(() => {
      expect(first).toHaveLength(2);
    });
    expect(screen.queryByText('99 archived tasks')).not.toBeInTheDocument();
    first[1]!.resolve({
      data: { cards: [card, other], totalCount: 10, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('10 archived tasks')).toBeInTheDocument();
    expect(screen.getAllByText('Ship the grid').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Write tests').length).toBeGreaterThan(0);
  });

  it('applies a first page that excluded a released id', async () => {
    const user = userEvent.setup();
    const { first } = holdCardPages();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card, other]}
        initialTotalCount={10}
        canAdminister
      />,
    );

    await user.click(
      within(archivedRow('Write tests')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    expect(listArchivedCards).toHaveBeenCalledWith({
      projectId: 'project-1',
      query: '',
      range: '7',
      sort: 'date',
      excludeIds: ['card-1'],
    });
    first[0]!.resolve({
      data: { cards: [other], totalCount: 9, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('9 archived tasks')).toBeInTheDocument();
    expect(screen.getAllByText('Ship the grid').length).toBeGreaterThan(0);
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    expect(first).toHaveLength(1);
  });

  it('restores a task and undoes from the toast', async () => {
    const user = userEvent.setup();
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card]}
        canAdminister
        initialTotalCount={1}
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
        initialTotalCount={1}
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
        initialTotalCount={2}
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

  it('hides Load more when hasMore is false even if totalCount is higher than loaded rows', () => {
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card]}
        initialTotalCount={99}
        initialHasMore={false}
        initialNextCursor={null}
        canAdminister
      />,
    );

    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
  });

  it('sends the server cursor and makes no further request after hasMore is false', async () => {
    const user = userEvent.setup();
    listArchivedCards.mockResolvedValue({
      data: { cards: [other], totalCount: 2, hasMore: false, nextCursor: null },
    });
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card]}
        initialTotalCount={2}
        initialHasMore
        initialNextCursor="cursor-from-server"
        canAdminister
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(listArchivedCards).toHaveBeenCalledWith({
        projectId: 'project-1',
        query: '',
        range: 'all',
        sort: 'date',
        cursor: 'cursor-from-server',
        excludeIds: [],
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
    });
    expect(listArchivedCards).toHaveBeenCalledTimes(1);
  });

  it('does not send the same cursor again while load more is pending', async () => {
    const olderResolves: Array<(value: ListArchivedCardsResult) => void> = [];
    listArchivedCards.mockImplementation(
      async () =>
        new Promise<ListArchivedCardsResult>((resolve) => {
          olderResolves.push(resolve);
        }),
    );
    renderView(
      <ArchivedView
        projectId="project-1"
        projectTitle="Sprint board"
        initialCards={[card]}
        initialTotalCount={2}
        initialHasMore
        initialNextCursor="cursor-from-server"
        canAdminister
      />,
    );

    const button = screen.getByRole('button', { name: 'View older' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(listArchivedCards).toHaveBeenCalledTimes(1);
    expect(listArchivedCards).toHaveBeenCalledWith({
      projectId: 'project-1',
      query: '',
      range: 'all',
      sort: 'date',
      cursor: 'cursor-from-server',
      excludeIds: [],
    });
    expect(button).toBeDisabled();

    olderResolves[0]!({
      data: { cards: [other], totalCount: 2, hasMore: false, nextCursor: null },
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
    });
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

const olderArchivedProject: ArchivedProject = {
  ...archivedProject,
  id: 'project-2',
  title: 'Older board',
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
    renderView(<ArchivedView initialProjects={[]} initialTotalCount={0} />);

    expect(screen.getByText('No archived projects')).toBeInTheDocument();
    expect(
      screen.getByText(
        'When you archive a project from its board it will show up here, with its history intact.',
      ),
    ).toBeInTheDocument();
  });

  it('hides export and batch delete', () => {
    renderView(<ArchivedView initialProjects={[archivedProject]} initialTotalCount={1} />);

    expect(screen.queryAllByRole('button', { name: 'Export' })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Delete permanently' }).length).toBeGreaterThan(0);
  });

  it('keeps restore and delete disabled for a member of that project', () => {
    renderView(
      <ArchivedView
        initialProjects={[{ ...archivedProject, canAdminister: false }]}
        initialTotalCount={1}
      />,
    );

    for (const button of screen.getAllByRole('button', { name: 'Restore' })) {
      expect(button).toBeDisabled();
    }
    for (const button of screen.getAllByRole('button', { name: 'Delete permanently' })) {
      expect(button).toBeDisabled();
    }
  });

  it('requires typing the project title before permanent delete', async () => {
    const user = userEvent.setup();
    renderView(<ArchivedView initialProjects={[archivedProject]} initialTotalCount={1} />);

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

  it('hides Load more when hasMore is false even if totalCount is higher than loaded rows', () => {
    renderView(
      <ArchivedView
        initialProjects={[archivedProject]}
        initialTotalCount={99}
        initialHasMore={false}
        initialNextCursor={null}
      />,
    );

    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
  });

  it('sends the server cursor and makes no further request after hasMore is false', async () => {
    const user = userEvent.setup();
    const olderProject: ArchivedProject = {
      ...archivedProject,
      id: 'project-2',
      title: 'Older board',
    };
    listArchivedProjects.mockResolvedValue({
      data: { projects: [olderProject], totalCount: 2, hasMore: false, nextCursor: null },
    });
    renderView(
      <ArchivedView
        initialProjects={[archivedProject]}
        initialTotalCount={2}
        initialHasMore
        initialNextCursor="cursor-from-server"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(listArchivedProjects).toHaveBeenCalledWith({
        query: '',
        range: 'all',
        sort: 'date',
        cursor: 'cursor-from-server',
        excludeIds: [],
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
    });
    expect(listArchivedProjects).toHaveBeenCalledTimes(1);
  });

  it('dims leftover rows and the count after a filter change until the first page arrives', async () => {
    const user = userEvent.setup();
    const { first } = holdProjectPages();
    renderView(
      <ArchivedView
        initialProjects={[archivedProject, olderArchivedProject]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    expectPendingArchivedList('4 archived projects', 'Sprint board');
    expect(screen.getAllByText('Older board').length).toBeGreaterThan(0);

    first[0]!.resolve({
      data: { projects: [archivedProject], totalCount: 1, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('1 archived project')).toBeInTheDocument();
    expect(screen.getByText('1 archived project').closest('[aria-busy="true"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
  });

  it('does not restore leftover projects while the new filter is pending', async () => {
    const user = userEvent.setup();
    holdProjectPages();
    renderView(
      <ArchivedView
        initialProjects={[archivedProject]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(listArchivedProjects).toHaveBeenCalled();
    });
    expectPendingArchivedList('4 archived projects', 'Sprint board');
    await user.click(
      within(archivedRow('Sprint board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    expect(restoreArchivedProjects).not.toHaveBeenCalled();
    await user.click(archivedRow('Sprint board'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows No results only after the current filter first page is empty', async () => {
    const user = userEvent.setup();
    const { first } = holdProjectPages();
    renderView(<ArchivedView initialProjects={[]} initialTotalCount={0} />);

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
    expect(screen.getByText('0 archived projects').closest('[aria-busy="true"]')).not.toBeNull();

    first[0]!.resolve({
      data: { projects: [], totalCount: 0, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('No results')).toBeInTheDocument();
  });

  it('ignores a previous-filter first page that resolves after a later filter change', async () => {
    const user = userEvent.setup();
    const pages: Array<{ range?: string; held: Held<ListArchivedProjectsResult> }> = [];
    listArchivedProjects.mockImplementation(async (input) => {
      return new Promise<ListArchivedProjectsResult>((resolve, reject) => {
        pages.push({ range: input?.range, held: { resolve, reject } });
      });
    });
    const seven: ArchivedProject = { ...archivedProject, id: 'project-7', title: 'Seven only' };
    const thirty: ArchivedProject = { ...archivedProject, id: 'project-30', title: 'Thirty only' };
    renderView(<ArchivedView initialProjects={[archivedProject]} initialTotalCount={4} />);

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await user.click(screen.getByRole('button', { name: /Last 30 days/ }));
    await waitFor(() => {
      expect(pages.map((page) => page.range)).toEqual(['7', '30']);
    });

    pages[0]!.held.resolve({
      data: { projects: [seven], totalCount: 99, hasMore: true, nextCursor: 'stale-7' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Seven only')).not.toBeInTheDocument();
    });
    expectPendingArchivedList('4 archived projects', 'Sprint board');

    pages[1]!.held.resolve({
      data: { projects: [thirty], totalCount: 2, hasMore: false, nextCursor: null },
    });
    expect(await screen.findAllByText('Thirty only')).not.toHaveLength(0);
    expect(screen.getByText('2 archived projects')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
  });

  it('discards a load-more response that arrives after the new first page', async () => {
    const user = userEvent.setup();
    const { first, older } = holdProjectPages();
    renderView(
      <ArchivedView
        initialProjects={[archivedProject]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
      expect(older).toHaveLength(1);
    });
    expectPendingArchivedList('4 archived projects', 'Sprint board');

    first[0]!.resolve({
      data: { projects: [archivedProject], totalCount: 1, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('1 archived project')).toBeInTheDocument();

    older[0]!.resolve({
      data: {
        projects: [olderArchivedProject],
        totalCount: 99,
        hasMore: true,
        nextCursor: 'cursor-stale',
      },
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Older board')).toHaveLength(0);
    });
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
    expect(screen.queryByText('99 archived projects')).not.toBeInTheDocument();
  });

  it('discards a load-more response that arrives before the new first page', async () => {
    const user = userEvent.setup();
    const { first, older } = holdProjectPages();
    renderView(
      <ArchivedView
        initialProjects={[archivedProject]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
      expect(older).toHaveLength(1);
    });

    older[0]!.resolve({
      data: {
        projects: [olderArchivedProject],
        totalCount: 99,
        hasMore: true,
        nextCursor: 'cursor-stale',
      },
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Older board')).toHaveLength(0);
    });
    expectPendingArchivedList('4 archived projects', 'Sprint board');

    first[0]!.resolve({
      data: { projects: [archivedProject], totalCount: 1, hasMore: false, nextCursor: null },
    });
    expect(await screen.findByText('1 archived project')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View older' })).not.toBeInTheDocument();
  });

  it('shows a retry control when the first page rejects and retry loads the current filter', async () => {
    const user = userEvent.setup();
    const first: Held<ListArchivedProjectsResult>[] = [];
    listArchivedProjects.mockImplementation(async (input) => {
      if (input?.cursor) {
        return { data: { projects: [], totalCount: 0, hasMore: false, nextCursor: null } };
      }
      if (first.length === 0) {
        return new Promise<ListArchivedProjectsResult>((resolve, reject) => {
          first.push({ resolve, reject });
        });
      }
      return {
        data: { projects: [olderArchivedProject], totalCount: 1, hasMore: false, nextCursor: null },
      };
    });
    renderView(
      <ArchivedView
        initialProjects={[archivedProject]}
        initialTotalCount={4}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(first).toHaveLength(1);
    });
    first[0]!.reject(new Error('network'));
    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expectPendingArchivedList('4 archived projects', 'Sprint board');

    await user.click(
      within(archivedRow('Sprint board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    expect(restoreArchivedProjects).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('1 archived project')).toBeInTheDocument();
    expect(screen.getAllByText('Older board').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('1 archived project').closest('[aria-busy="true"]')).toBeNull();
  });

  it('does not subtract leftover lastPageIds after a count-only writer', async () => {
    const user = userEvent.setup();
    const { older } = holdProjectPages();
    const counts = holdCountProjects();
    renderView(
      <ArchivedView
        initialProjects={[archivedProject, olderArchivedProject]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(
      within(archivedRow('Sprint board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: { projects: [olderArchivedProject], totalCount: 9, hasMore: false, nextCursor: null },
    });
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    expect(countArchivedProjects).toHaveBeenCalledWith({
      query: '',
      range: 'all',
      excludeIds: ['project-1'],
    });

    await user.click(
      within(archivedRow('Older board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    counts[0]!.resolve({ data: { totalCount: 8, excludeIds: ['project-1'] } });
    expect(await screen.findByText('8 archived projects')).toBeInTheDocument();
    expect(screen.queryByText('7 archived projects')).not.toBeInTheDocument();
    expect(screen.queryByText('Sprint board')).not.toBeInTheDocument();
    expect(screen.queryByText('Older board')).not.toBeInTheDocument();
  });

  it('does not let an older count-only response overwrite a newer totalCount', async () => {
    const user = userEvent.setup();
    const { older } = holdProjectPages();
    const counts = holdCountProjects();
    renderView(
      <ArchivedView
        initialProjects={[archivedProject, olderArchivedProject]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(
      within(archivedRow('Sprint board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: {
        projects: [{ ...archivedProject, id: 'project-3', title: 'Later board' }],
        totalCount: 10,
        hasMore: false,
        nextCursor: null,
      },
    });
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });

    await user.click(
      within(archivedRow('Older board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(2);
    });
    counts[1]!.resolve({ data: { totalCount: 8, excludeIds: ['project-1', 'project-2'] } });
    expect(await screen.findByText('8 archived projects')).toBeInTheDocument();
    counts[0]!.resolve({ data: { totalCount: 99, excludeIds: ['project-1'] } });
    await waitFor(() => {
      expect(screen.getByText('8 archived projects')).toBeInTheDocument();
    });
    expect(screen.queryByText('99 archived projects')).not.toBeInTheDocument();
    expect(countArchivedProjects).toHaveBeenCalledTimes(2);
  });

  it('converges after hiding a row while a count-only request is in flight', async () => {
    const user = userEvent.setup();
    const { older } = holdProjectPages();
    const counts = holdCountProjects();
    renderView(
      <ArchivedView
        initialProjects={[archivedProject, olderArchivedProject]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await user.click(
      within(archivedRow('Sprint board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: {
        projects: [{ ...archivedProject, id: 'project-3', title: 'Later board' }],
        totalCount: 10,
        hasMore: false,
        nextCursor: null,
      },
    });
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });

    await user.click(
      within(archivedRow('Older board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(2);
    });
    counts[0]!.resolve({ data: { totalCount: 8, excludeIds: ['project-1'] } });
    counts[1]!.resolve({ data: { totalCount: 8, excludeIds: ['project-1', 'project-2'] } });
    expect(await screen.findByText('8 archived projects')).toBeInTheDocument();
    expect(screen.getAllByText('Later board').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sprint board')).not.toBeInTheDocument();
    expect(screen.queryByText('Older board')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(countArchivedProjects).toHaveBeenCalledTimes(2);
    });
    expect(listArchivedProjects.mock.calls.filter((call) => call[0]?.cursor).length).toBe(1);
  });

  it('advances the View older cursor when load more finishes after a newer count-only', async () => {
    const user = userEvent.setup();
    const { older } = holdProjectPages();
    const counts = holdCountProjects();
    const laterProject: ArchivedProject = {
      ...archivedProject,
      id: 'project-3',
      title: 'Later board',
    };
    const oldestProject: ArchivedProject = {
      ...archivedProject,
      id: 'project-4',
      title: 'Oldest board',
    };
    renderView(
      <ArchivedView
        initialProjects={[archivedProject, olderArchivedProject]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: {
        projects: [laterProject],
        totalCount: 10,
        hasMore: true,
        nextCursor: 'cursor-page-2',
      },
    });
    expect(await screen.findAllByText('Later board')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(2);
    });
    await user.click(
      within(archivedRow('Sprint board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['project-1'] } });
    expect(await screen.findByText('9 archived projects')).toBeInTheDocument();

    older[1]!.resolve({
      data: {
        projects: [oldestProject],
        totalCount: 99,
        hasMore: true,
        nextCursor: 'cursor-page-3',
      },
    });
    expect(await screen.findAllByText('Oldest board')).not.toHaveLength(0);
    expect(screen.getByText('9 archived projects')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(
        listArchivedProjects.mock.calls.some((call) => call[0]?.cursor === 'cursor-page-3'),
      ).toBe(true);
    });
  });

  it('refreshes the count after a failed restore whose count-only had excluded the row', async () => {
    const user = userEvent.setup();
    const { older } = holdProjectPages();
    const counts = holdCountProjects();
    const restoreResolves: Array<(value: { error: string }) => void> = [];
    restoreArchivedProjects.mockImplementation(
      () =>
        new Promise<{ error: string }>((resolve) => {
          restoreResolves.push(resolve);
        }),
    );
    renderView(
      <ArchivedView
        initialProjects={[archivedProject, olderArchivedProject]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: {
        projects: [{ ...archivedProject, id: 'project-3', title: 'Later board' }],
        totalCount: 10,
        hasMore: false,
        nextCursor: null,
      },
    });
    await user.click(
      within(archivedRow('Sprint board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['project-1'] } });
    expect(await screen.findByText('9 archived projects')).toBeInTheDocument();

    restoreResolves[0]!({ error: 'Unauthorized' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Unauthorized');
    expect(screen.getAllByText('Sprint board').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(counts).toHaveLength(2);
    });
    counts[1]!.resolve({ data: { totalCount: 10, excludeIds: [] } });
    expect(await screen.findByText('10 archived projects')).toBeInTheDocument();
  });

  it('refreshes the count after Undo unhides a row excluded by count-only', async () => {
    const user = userEvent.setup();
    const { older } = holdProjectPages();
    const counts = holdCountProjects();
    renderView(
      <ArchivedView
        initialProjects={[archivedProject, olderArchivedProject]}
        initialTotalCount={10}
        initialHasMore
        initialNextCursor="cursor-page-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View older' }));
    await waitFor(() => {
      expect(older).toHaveLength(1);
    });
    older[0]!.resolve({
      data: {
        projects: [{ ...archivedProject, id: 'project-3', title: 'Later board' }],
        totalCount: 10,
        hasMore: false,
        nextCursor: null,
      },
    });
    await user.click(
      within(archivedRow('Sprint board')).getAllByRole('button', { name: 'Restore' })[0]!,
    );
    await waitFor(() => {
      expect(counts).toHaveLength(1);
    });
    counts[0]!.resolve({ data: { totalCount: 9, excludeIds: ['project-1'] } });
    expect(await screen.findByText('9 archived projects')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getAllByText('Sprint board').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(rearchiveArchivedProjects).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(counts).toHaveLength(2);
    });
    counts[1]!.resolve({ data: { totalCount: 10, excludeIds: [] } });
    expect(await screen.findByText('10 archived projects')).toBeInTheDocument();
  });
});
