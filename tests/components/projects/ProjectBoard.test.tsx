// tests/components/projects/ProjectBoard.test.tsx
//
// Tests for the project board persist queue and optimistic column moves.
//
// Tested:
// - Renders columns and cards on the desktop board
// - On persist failure after an optimistic move, cards revert and a generic alert is shown
// - On moveCard promise rejection, cards revert with the same generic alert
// - Queued persists: first fails then second succeeds without leaving a ghost from the first
// - Queued persists: both fail and the UI returns to the original board
// - Columns refresh while moves are queued does not drop later moveCard calls
// - After a successful move, progress counts follow the new column membership
//
// What is covered:
// - Render layout, optimistic rollback, serialized persist races, progress
//
// Run with: pnpm test:run tests/components/projects/ProjectBoard.test.tsx
//
// SEE: src/components/projects/ProjectBoard.tsx

import { createRef } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';

import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import type { ProjectBoardHandle } from '@/components/projects/ProjectBoard';
import type { BoardColumnData } from '@/components/projects/boardTypes';

const moveCard = vi.fn();

vi.mock('@/actions/moveCard', () => ({
  moveCard,
}));

vi.mock('@/components/labels/LabelsControl', () => ({
  default: () => null,
}));

const { default: ProjectBoard } = await import('@/components/projects/ProjectBoard');

const columns: BoardColumnData[] = [
  {
    id: 'column-todo',
    title: 'To do',
    order: 0,
    cards: [
      { id: 'card-a', title: 'Card A', code: 'CA-1', dueDate: null },
      { id: 'card-b', title: 'Card B', code: 'CB-2', dueDate: null },
    ],
  },
  {
    id: 'column-doing',
    title: 'Doing',
    order: 1,
    cards: [{ id: 'card-c', title: 'Card C', code: 'CC-3', dueDate: null }],
  },
  {
    id: 'column-done',
    title: 'Done',
    order: 2,
    cards: [],
  },
];

function desktopBoard() {
  const root = document.querySelector('[data-board="desktop"]');
  if (!root) throw new Error('Missing desktop board');
  return root as HTMLElement;
}

function desktopColumn(title: string) {
  const heading = within(desktopBoard()).getByRole('heading', { name: title, level: 2 });
  const region = heading.closest('[data-column-id]');
  if (!region) throw new Error(`Missing column region for ${title}`);
  return region as HTMLElement;
}

function cardTitlesInColumn(title: string): string[] {
  return within(desktopColumn(title))
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent?.trim() ?? '');
}

describe('ProjectBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  it('renders column titles and cards in their columns', () => {
    render(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    expect(
      within(desktopBoard()).getByRole('heading', { name: 'To do', level: 2 }),
    ).toBeInTheDocument();
    expect(within(desktopColumn('To do')).getByText('Card A')).toBeInTheDocument();
    expect(within(desktopColumn('To do')).getByText('Card B')).toBeInTheDocument();
    expect(within(desktopColumn('Doing')).getByText('Card C')).toBeInTheDocument();
    expect(within(desktopColumn('Doing')).queryByText('Card A')).not.toBeInTheDocument();
    expect(within(desktopColumn('Done')).queryByText('Nothing here yet')).not.toBeInTheDocument();
  });

  it('reverts the optimistic move and shows a generic alert when persist fails', async () => {
    let resolveMove: (result: { error: string }) => void = () => {};
    moveCard.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMove = resolve;
        }),
    );

    const ref = createRef<ProjectBoardHandle>();
    render(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );
    expect(ref.current).not.toBeNull();

    let commitPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      commitPromise = ref.current!.commitMove('card-a', 'column-doing');
      await Promise.resolve();
    });

    expect(within(desktopColumn('Doing')).getByText('Card A')).toBeInTheDocument();
    expect(within(desktopColumn('To do')).queryByText('Card A')).not.toBeInTheDocument();

    await act(async () => {
      resolveMove({ error: 'Something went wrong. Please try again.' });
      await commitPromise;
    });

    expect(cardTitlesInColumn('To do')).toEqual(['Card A', 'Card B']);
    expect(cardTitlesInColumn('Doing')).toEqual(['Card C']);
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(moveCard).toHaveBeenCalledWith({
      cardId: 'card-a',
      sourceColumnId: 'column-todo',
      targetColumnId: 'column-doing',
    });
  });

  it('reverts the optimistic move when moveCard rejects', async () => {
    let rejectMove: (reason: Error) => void = () => {};
    moveCard.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectMove = reject;
        }),
    );

    const ref = createRef<ProjectBoardHandle>();
    render(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    let commitPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      commitPromise = ref.current!.commitMove('card-a', 'column-doing');
      await Promise.resolve();
    });

    expect(cardTitlesInColumn('Doing')).toEqual(['Card C', 'Card A']);

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

    const ref = createRef<ProjectBoardHandle>();
    render(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    let firstCommit: Promise<void> = Promise.resolve();
    let secondCommit: Promise<void> = Promise.resolve();

    await act(async () => {
      firstCommit = ref.current!.commitMove('card-a', 'column-doing');
      await Promise.resolve();
    });

    await act(async () => {
      secondCommit = ref.current!.commitMove('card-b', 'column-doing');
      await Promise.resolve();
    });

    expect(cardTitlesInColumn('Doing')).toEqual(['Card C', 'Card A', 'Card B']);
    expect(resolvers).toHaveLength(1);

    await act(async () => {
      resolvers[0]!({ error: 'Something went wrong. Please try again.' });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(cardTitlesInColumn('To do')).toEqual(['Card A']);
    });
    expect(cardTitlesInColumn('Doing')).toEqual(['Card C', 'Card B']);
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);

    await waitFor(() => {
      expect(resolvers).toHaveLength(2);
    });

    await act(async () => {
      resolvers[1]!({ data: { id: 'card-b' } });
      await Promise.all([firstCommit, secondCommit]);
    });

    expect(cardTitlesInColumn('To do')).toEqual(['Card A']);
    expect(cardTitlesInColumn('Doing')).toEqual(['Card C', 'Card B']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(moveCard).toHaveBeenLastCalledWith({
      cardId: 'card-b',
      sourceColumnId: 'column-todo',
      targetColumnId: 'column-doing',
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

    const ref = createRef<ProjectBoardHandle>();
    render(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    let firstCommit: Promise<void> = Promise.resolve();
    let secondCommit: Promise<void> = Promise.resolve();

    await act(async () => {
      firstCommit = ref.current!.commitMove('card-a', 'column-doing');
      secondCommit = ref.current!.commitMove('card-b', 'column-doing');
      await Promise.resolve();
    });

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

    const ref = createRef<ProjectBoardHandle>();
    const { rerender } = render(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    let firstCommit: Promise<void> = Promise.resolve();
    let secondCommit: Promise<void> = Promise.resolve();
    let thirdCommit: Promise<void> = Promise.resolve();

    await act(async () => {
      firstCommit = ref.current!.commitMove('card-a', 'column-doing');
      secondCommit = ref.current!.commitMove('card-b', 'column-doing');
      thirdCommit = ref.current!.commitMove('card-c', 'column-todo');
      await Promise.resolve();
    });

    expect(resolvers).toHaveLength(1);
    expect(cardTitlesInColumn('Doing')).toEqual(['Card A', 'Card B']);
    expect(cardTitlesInColumn('To do')).toEqual(['Card C']);

    const columnsAfterFirstPersist: BoardColumnData[] = [
      {
        id: 'column-todo',
        title: 'To do',
        order: 0,
        cards: [
          { id: 'card-b', title: 'Card B', code: 'CB-2', dueDate: null },
          { id: 'card-d', title: 'Card D', code: 'CD-4', dueDate: null },
        ],
      },
      {
        id: 'column-doing',
        title: 'Doing',
        order: 1,
        cards: [
          { id: 'card-c', title: 'Card C', code: 'CC-3', dueDate: null },
          { id: 'card-a', title: 'Card A', code: 'CA-1', dueDate: null },
        ],
      },
      {
        id: 'column-done',
        title: 'Done',
        order: 2,
        cards: [],
      },
    ];

    await act(async () => {
      rerender(
        <ProjectBoard
          ref={ref}
          title="Sprint board"
          projectId="project-1"
          labels={[]}
          columns={columnsAfterFirstPersist}
          members={[]}
        />,
      );
    });

    expect(cardTitlesInColumn('Doing')).toEqual(['Card A', 'Card B']);
    expect(cardTitlesInColumn('To do')).toEqual(['Card D', 'Card C']);
    expect(within(desktopColumn('To do')).getByText('Card D')).toBeInTheDocument();

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
        sourceColumnId: 'column-todo',
        targetColumnId: 'column-doing',
      },
      {
        cardId: 'card-b',
        sourceColumnId: 'column-todo',
        targetColumnId: 'column-doing',
      },
      {
        cardId: 'card-c',
        sourceColumnId: 'column-doing',
        targetColumnId: 'column-todo',
      },
    ]);
    expect(cardTitlesInColumn('To do')).toEqual(['Card D', 'Card C']);
    expect(cardTitlesInColumn('Doing')).toEqual(['Card A', 'Card B']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('updates progress when a card moves into Done', async () => {
    moveCard.mockResolvedValue({ data: { id: 'card-a' } });
    const ref = createRef<ProjectBoardHandle>();
    render(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    expect(screen.getByText('0 of 3 cards done')).toBeInTheDocument();

    await act(async () => {
      await ref.current!.commitMove('card-a', 'column-done');
    });

    expect(screen.getByText('1 of 3 cards done')).toBeInTheDocument();
    expect(within(desktopColumn('Done')).getByText('Card A')).toBeInTheDocument();
  });
});
