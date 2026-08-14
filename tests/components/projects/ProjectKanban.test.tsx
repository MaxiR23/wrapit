// tests/components/projects/ProjectKanban.test.tsx
//
// Tests for the kanban board drag-and-drop surface.
//
// Tested:
// - Renders columns horizontally with cards in each column
// - Labels each delete button with the column title
// - Requires confirmation before calling deleteColumn
// - On persist failure after an optimistic move, cards revert and a generic alert is shown
// - On moveCard promise rejection, cards revert with the same generic alert (no hung optimistic state)
// - Queued persists: first fails then second succeeds without leaving a ghost from the first
// - After A fails from intended [A,B,C], B stays as [B,C] until it persists (pending queue kept)
// - Queued persists: both fail and the UI returns to the original board with no ghosts
// - Columns refresh (revalidatePath) while moves are queued does not drop later moveCard calls
// - Columns refresh with an external new card keeps that card after queued persists finish
//
// What is covered:
// - Render layout, confirm-delete, optimistic rollback, serialized persist races, and card order
//
// Run with: pnpm test:run tests/components/projects/ProjectKanban.test.tsx
//
// SEE: src/components/projects/ProjectKanban.tsx

import { createRef } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import type { ProjectKanbanHandle } from '@/components/projects/ProjectKanban';

const moveCard = vi.fn();
const deleteColumn = vi.fn();

vi.mock('@/actions/moveCard', () => ({
  moveCard,
}));

vi.mock('@/actions/deleteColumn', () => ({
  deleteColumn,
}));

vi.mock('@/components/cards/NewCardDialog', () => ({
  default: ({ columnTitle }: { columnTitle: string }) => (
    <button type="button" aria-label={`New card in ${columnTitle}`}>
      New card
    </button>
  ),
}));

vi.mock('@/components/cards/EditCardDialog', () => ({
  default: ({ title }: { title: string }) => (
    <button type="button" aria-label={`Edit card ${title}`}>
      Edit
    </button>
  ),
}));

vi.mock('@/components/cards/DeleteCardDialog', () => ({
  default: ({ title }: { title: string }) => (
    <button type="button" aria-label={`Delete card ${title}`}>
      Delete
    </button>
  ),
}));

const { default: ProjectKanban } = await import('@/components/projects/ProjectKanban');

const columns = [
  {
    id: 'column-todo',
    title: 'To do',
    cards: [
      { id: 'card-a', title: 'Card A', description: null },
      { id: 'card-b', title: 'Card B', description: null },
    ],
  },
  {
    id: 'column-doing',
    title: 'Doing',
    cards: [{ id: 'card-c', title: 'Card C', description: 'In progress' }],
  },
];

function columnRegion(title: string) {
  const heading = screen.getByRole('heading', { name: title, level: 2 });
  const region = heading.closest('[data-column-id]');
  if (!region) throw new Error(`Missing column region for ${title}`);
  return region as HTMLElement;
}

/** Card titles in DOM order within a column (not just membership). */
function cardTitlesInColumn(title: string): string[] {
  const list = columnRegion(title).querySelector('ul.flex.flex-col');
  if (!list) return [];
  return Array.from(list.querySelectorAll(':scope > li')).map((li) => {
    const titleEl = li.querySelector('p.font-medium');
    return titleEl?.textContent?.trim() ?? '';
  });
}

describe('ProjectKanban', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteColumn.mockResolvedValue({ data: { id: 'column-todo' } });
  });

  it('renders column titles and cards in their columns', () => {
    render(<ProjectKanban columns={columns} />);

    expect(screen.getByRole('heading', { name: 'To do', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Doing', level: 2 })).toBeInTheDocument();

    expect(within(columnRegion('To do')).getByText('Card A')).toBeInTheDocument();
    expect(within(columnRegion('To do')).getByText('Card B')).toBeInTheDocument();
    expect(within(columnRegion('Doing')).getByText('Card C')).toBeInTheDocument();
    expect(within(columnRegion('Doing')).queryByText('Card A')).not.toBeInTheDocument();
  });

  it('labels each delete button with the column title', () => {
    render(<ProjectKanban columns={columns} />);

    expect(screen.getByRole('button', { name: 'Delete column To do' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete column Doing' })).toBeInTheDocument();
  });

  it('requires confirmation before calling deleteColumn', async () => {
    const user = userEvent.setup();
    render(<ProjectKanban columns={[{ id: 'column-todo', title: 'To do', cards: [] }]} />);

    await user.click(screen.getByRole('button', { name: 'Delete column To do' }));

    expect(deleteColumn).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Delete column' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm delete column To do' }));

    expect(deleteColumn).toHaveBeenCalledWith({ columnId: 'column-todo' });
  });

  it('does not delete when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectKanban columns={[{ id: 'column-todo', title: 'To do', cards: [] }]} />);

    await user.click(screen.getByRole('button', { name: 'Delete column To do' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(deleteColumn).not.toHaveBeenCalled();
  });

  it('disables confirm while pending and only closes on success', async () => {
    let resolveDelete: (value: { data: { id: string } }) => void = () => {};
    deleteColumn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<ProjectKanban columns={[{ id: 'column-todo', title: 'To do', cards: [] }]} />);

    await user.click(screen.getByRole('button', { name: 'Delete column To do' }));

    const confirmButton = await screen.findByRole('button', {
      name: 'Confirm delete column To do',
    });
    await user.click(confirmButton);

    expect(deleteColumn).toHaveBeenCalledTimes(1);
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Delete column' })).toBeInTheDocument();

    await user.click(confirmButton);
    expect(deleteColumn).toHaveBeenCalledTimes(1);

    resolveDelete({ data: { id: 'column-todo' } });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete column' })).not.toBeInTheDocument();
    });
  });

  it('reverts the optimistic move and shows a generic alert when persist fails', async () => {
    let resolveMove: (result: { error: string }) => void = () => {};
    moveCard.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMove = resolve;
        }),
    );

    const ref = createRef<ProjectKanbanHandle>();
    render(<ProjectKanban ref={ref} columns={columns} />);
    expect(ref.current).not.toBeNull();

    expect(within(columnRegion('To do')).getByText('Card A')).toBeInTheDocument();
    expect(within(columnRegion('Doing')).queryByText('Card A')).not.toBeInTheDocument();

    let commitPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      commitPromise = ref.current!.commitMove({
        cardId: 'card-a',
        targetColumnId: 'column-doing',
        beforeCardId: null,
        afterCardId: 'card-c',
        nextItems: {
          'column-todo': ['card-b'],
          'column-doing': ['card-a', 'card-c'],
        },
      });
      // Flush the optimistic setState before the persist promise settles.
      await Promise.resolve();
    });

    expect(within(columnRegion('Doing')).getByText('Card A')).toBeInTheDocument();
    expect(within(columnRegion('To do')).queryByText('Card A')).not.toBeInTheDocument();

    await act(async () => {
      resolveMove({ error: 'Something went wrong. Please try again.' });
      await commitPromise;
    });

    expect(within(columnRegion('To do')).getByText('Card A')).toBeInTheDocument();
    expect(within(columnRegion('Doing')).queryByText('Card A')).not.toBeInTheDocument();
    expect(within(columnRegion('Doing')).getByText('Card C')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(moveCard).toHaveBeenCalledWith({
      cardId: 'card-a',
      targetColumnId: 'column-doing',
      beforeCardId: null,
      afterCardId: 'card-c',
    });
  });

  it('reverts the optimistic move when moveCard rejects (e.g. network failure)', async () => {
    let rejectMove: (reason: Error) => void = () => {};
    moveCard.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectMove = reject;
        }),
    );

    const ref = createRef<ProjectKanbanHandle>();
    render(<ProjectKanban ref={ref} columns={columns} />);

    let commitPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      commitPromise = ref.current!.commitMove({
        cardId: 'card-a',
        targetColumnId: 'column-doing',
        beforeCardId: null,
        afterCardId: 'card-c',
        nextItems: {
          'column-todo': ['card-b'],
          'column-doing': ['card-a', 'card-c'],
        },
      });
      await Promise.resolve();
    });

    expect(cardTitlesInColumn('Doing')).toEqual(['Card A', 'Card C']);

    await act(async () => {
      rejectMove(new Error('network down'));
      await commitPromise;
    });

    expect(cardTitlesInColumn('To do')).toEqual(['Card A', 'Card B']);
    expect(cardTitlesInColumn('Doing')).toEqual(['Card C']);
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
  });

  it('does not leave a ghost when an earlier queued persist fails and a later one succeeds', async () => {
    const resolvers: Array<(result: { data: { id: string } } | { error: string }) => void> = [];
    moveCard.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const ref = createRef<ProjectKanbanHandle>();
    render(<ProjectKanban ref={ref} columns={columns} />);
    expect(ref.current).not.toBeNull();

    let firstCommit: Promise<void> = Promise.resolve();
    let secondCommit: Promise<void> = Promise.resolve();

    await act(async () => {
      firstCommit = ref.current!.commitMove({
        cardId: 'card-a',
        targetColumnId: 'column-doing',
        beforeCardId: null,
        afterCardId: 'card-c',
        nextItems: {
          'column-todo': ['card-b'],
          'column-doing': ['card-a', 'card-c'],
        },
      });
      await Promise.resolve();
    });

    expect(within(columnRegion('Doing')).getByText('Card A')).toBeInTheDocument();
    expect(resolvers).toHaveLength(1);

    await act(async () => {
      secondCommit = ref.current!.commitMove({
        cardId: 'card-b',
        targetColumnId: 'column-doing',
        beforeCardId: 'card-a',
        afterCardId: 'card-c',
        nextItems: {
          'column-todo': [],
          'column-doing': ['card-a', 'card-b', 'card-c'],
        },
      });
      await Promise.resolve();
    });

    // Second persist is queued; only the first moveCard is in flight.
    expect(cardTitlesInColumn('Doing')).toEqual(['Card A', 'Card B', 'Card C']);
    expect(resolvers).toHaveLength(1);

    await act(async () => {
      resolvers[0]!({ error: 'Something went wrong. Please try again.' });
      await Promise.resolve();
    });

    // Failed job rolls back; remaining queued job B stays visible (not wiped).
    await waitFor(() => {
      expect(cardTitlesInColumn('To do')).toEqual(['Card A']);
    });
    expect(cardTitlesInColumn('Doing')).toEqual(['Card B', 'Card C']);
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);

    await waitFor(() => {
      expect(resolvers).toHaveLength(2);
    });

    await act(async () => {
      resolvers[1]!({ data: { id: 'card-b' } });
      await Promise.all([firstCommit, secondCommit]);
    });

    // First move never persisted; second move kept before C (not after) via neighbor reconcile.
    expect(cardTitlesInColumn('To do')).toEqual(['Card A']);
    expect(cardTitlesInColumn('Doing')).toEqual(['Card B', 'Card C']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(moveCard).toHaveBeenLastCalledWith({
      cardId: 'card-b',
      targetColumnId: 'column-doing',
      beforeCardId: null,
      afterCardId: 'card-c',
    });
  });

  it('reverts to the original board when two queued persists both fail', async () => {
    const resolvers: Array<(result: { data: { id: string } } | { error: string }) => void> = [];
    moveCard.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const ref = createRef<ProjectKanbanHandle>();
    render(<ProjectKanban ref={ref} columns={columns} />);
    expect(ref.current).not.toBeNull();

    let firstCommit: Promise<void> = Promise.resolve();
    let secondCommit: Promise<void> = Promise.resolve();

    await act(async () => {
      firstCommit = ref.current!.commitMove({
        cardId: 'card-a',
        targetColumnId: 'column-doing',
        beforeCardId: null,
        afterCardId: 'card-c',
        nextItems: {
          'column-todo': ['card-b'],
          'column-doing': ['card-a', 'card-c'],
        },
      });
      secondCommit = ref.current!.commitMove({
        cardId: 'card-b',
        targetColumnId: 'column-doing',
        beforeCardId: 'card-a',
        afterCardId: 'card-c',
        nextItems: {
          'column-todo': [],
          'column-doing': ['card-a', 'card-b', 'card-c'],
        },
      });
      await Promise.resolve();
    });

    expect(within(columnRegion('Doing')).getByText('Card A')).toBeInTheDocument();
    expect(within(columnRegion('Doing')).getByText('Card B')).toBeInTheDocument();
    expect(resolvers).toHaveLength(1);

    await act(async () => {
      resolvers[0]!({ error: 'Something went wrong. Please try again.' });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(resolvers).toHaveLength(2);
    });

    await act(async () => {
      resolvers[1]!({ error: 'Something went wrong. Please try again.' });
      await Promise.all([firstCommit, secondCommit]);
    });

    expect(cardTitlesInColumn('To do')).toEqual(['Card A', 'Card B']);
    expect(cardTitlesInColumn('Doing')).toEqual(['Card C']);
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
  });

  it('keeps queued moveCard calls after columns refresh while the first persist is pending', async () => {
    const resolvers: Array<(result: { data: { id: string } } | { error: string }) => void> = [];
    moveCard.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const ref = createRef<ProjectKanbanHandle>();
    const { rerender } = render(<ProjectKanban ref={ref} columns={columns} />);
    expect(ref.current).not.toBeNull();

    let firstCommit: Promise<void> = Promise.resolve();
    let secondCommit: Promise<void> = Promise.resolve();
    let thirdCommit: Promise<void> = Promise.resolve();

    await act(async () => {
      firstCommit = ref.current!.commitMove({
        cardId: 'card-a',
        targetColumnId: 'column-doing',
        beforeCardId: null,
        afterCardId: 'card-c',
        nextItems: {
          'column-todo': ['card-b'],
          'column-doing': ['card-a', 'card-c'],
        },
      });
      secondCommit = ref.current!.commitMove({
        cardId: 'card-b',
        targetColumnId: 'column-doing',
        beforeCardId: 'card-a',
        afterCardId: 'card-c',
        nextItems: {
          'column-todo': [],
          'column-doing': ['card-a', 'card-b', 'card-c'],
        },
      });
      thirdCommit = ref.current!.commitMove({
        cardId: 'card-c',
        targetColumnId: 'column-todo',
        beforeCardId: null,
        afterCardId: null,
        nextItems: {
          'column-todo': ['card-c'],
          'column-doing': ['card-a', 'card-b'],
        },
      });
      await Promise.resolve();
    });

    expect(resolvers).toHaveLength(1);
    expect(cardTitlesInColumn('Doing')).toEqual(['Card A', 'Card B']);
    expect(cardTitlesInColumn('To do')).toEqual(['Card C']);

    // Simulate revalidatePath from the first successful moveCard while later
    // jobs are still queued (and the first job has not been dequeued yet).
    // Include an external card that arrived on the server during the request.
    const columnsAfterFirstPersist = [
      {
        id: 'column-todo',
        title: 'To do',
        cards: [
          { id: 'card-b', title: 'Card B', description: null },
          { id: 'card-d', title: 'Card D', description: 'Added elsewhere' },
        ],
      },
      {
        id: 'column-doing',
        title: 'Doing',
        cards: [
          { id: 'card-a', title: 'Card A', description: null },
          { id: 'card-c', title: 'Card C', description: 'In progress' },
        ],
      },
    ];

    await act(async () => {
      rerender(<ProjectKanban ref={ref} columns={columnsAfterFirstPersist} />);
    });

    // Pending jobs B and C remain layered on the new server baseline.
    expect(cardTitlesInColumn('Doing')).toEqual(['Card A', 'Card B']);
    expect(cardTitlesInColumn('To do')).toEqual(['Card D', 'Card C']);
    expect(within(columnRegion('To do')).getByText('Card D')).toBeInTheDocument();

    await act(async () => {
      resolvers[0]!({ data: { id: 'card-a' } });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(resolvers).toHaveLength(2);
    });

    await act(async () => {
      resolvers[1]!({ data: { id: 'card-b' } });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(resolvers).toHaveLength(3);
    });

    await act(async () => {
      resolvers[2]!({ data: { id: 'card-c' } });
      await Promise.all([firstCommit, secondCommit, thirdCommit]);
    });

    expect(moveCard).toHaveBeenCalledTimes(3);
    expect(moveCard.mock.calls.map((call) => call[0])).toEqual([
      {
        cardId: 'card-a',
        targetColumnId: 'column-doing',
        beforeCardId: null,
        afterCardId: 'card-c',
      },
      {
        cardId: 'card-b',
        targetColumnId: 'column-doing',
        beforeCardId: 'card-a',
        afterCardId: 'card-c',
      },
      {
        cardId: 'card-c',
        targetColumnId: 'column-todo',
        beforeCardId: 'card-d',
        afterCardId: null,
      },
    ]);
    // External Card D from the refreshed props must survive the persist finishes.
    expect(cardTitlesInColumn('To do')).toEqual(['Card D', 'Card C']);
    expect(cardTitlesInColumn('Doing')).toEqual(['Card A', 'Card B']);
    expect(within(columnRegion('To do')).getByText('Card D')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
