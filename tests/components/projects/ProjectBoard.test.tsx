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
// - The column plus opens New task aimed at that column
// - Create is disabled without a title
// - A created card lands at the end of the chosen column
// - Clicking a card opens the detail dialog
// - Archive removes the card and shows a status toast
// - Label filters and search narrow the board and empty results show no-results
// - Turning off card code hides it on every card
// - A failed visibility persist reverts the face and shows a generic alert
// - Opening card detail closes the filters popover
//
// What is covered:
// - Render layout, optimistic rollback, serialized persist races, progress, new task modal, card detail
//
// Run with: pnpm test:run tests/components/projects/ProjectBoard.test.tsx
//
// SEE: src/components/projects/ProjectBoard.tsx

import { createRef, type ReactElement, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import type { ProjectBoardHandle } from '@/components/projects/ProjectBoard';
import type { BoardColumnData } from '@/components/projects/boardTypes';

const moveCard = vi.fn();
const createCard = vi.fn();

vi.mock('@/actions/moveCard', () => ({
  moveCard,
}));
vi.mock('@/actions/createCard', () => ({
  createCard,
}));
vi.mock('@/actions/archiveCard', () => ({
  archiveCard: vi.fn(async ({ cardId }: { cardId: string }) => ({ data: { id: cardId } })),
}));
vi.mock('@/actions/deleteCard', () => ({
  deleteCard: vi.fn(async ({ cardId }: { cardId: string }) => ({ data: { id: cardId } })),
}));
vi.mock('@/actions/updateCardField', () => ({
  updateCardField: vi.fn(async (input: { value: string }) => ({ data: { value: input.value } })),
}));
vi.mock('@/actions/updateCardAssignees', () => ({
  updateCardAssignees: vi.fn(async () => ({ data: { assignees: [] } })),
}));
vi.mock('@/actions/updateCardLabel', () => ({
  updateCardLabel: vi.fn(async () => ({ data: { labelId: null } })),
}));
vi.mock('@/actions/createSubtask', () => ({ createSubtask: vi.fn() }));
vi.mock('@/actions/updateSubtaskField', () => ({
  updateSubtaskField: vi.fn(async (input: { value: string | boolean }) => ({
    data: { value: input.value },
  })),
}));
vi.mock('@/actions/deleteSubtask', () => ({ deleteSubtask: vi.fn() }));
vi.mock('@/actions/createComment', () => ({ createComment: vi.fn() }));
vi.mock('@/actions/updateLabelField', () => ({
  updateLabelField: vi.fn(async (input: { value: string }) => ({ data: { value: input.value } })),
}));
vi.mock('@/actions/createLabel', () => ({ createLabel: vi.fn() }));
vi.mock('@/actions/deleteLabel', () => ({ deleteLabel: vi.fn() }));
const updateBoardVisibility = vi.fn(
  async (visibility: unknown): Promise<{ data: unknown } | { error: string }> => ({
    data: visibility,
  }),
);

vi.mock('@/actions/updateBoardVisibility', () => ({
  updateBoardVisibility,
}));

const { default: ProjectBoard } = await import('@/components/projects/ProjectBoard');
const { OpenPanelProvider } = await import('@/components/projects/OpenPanel');
const { ProjectsSearchProvider } = await import('@/components/projects/ProjectsSearch');

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

function BoardHarness({ children }: { children: ReactNode }) {
  return (
    <OpenPanelProvider>
      <ProjectsSearchProvider>{children}</ProjectsSearchProvider>
    </OpenPanelProvider>
  );
}

function renderBoard(ui: ReactElement) {
  return render(ui, { wrapper: BoardHarness });
}

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
    renderBoard(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
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
    renderBoard(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
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
    renderBoard(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
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
    renderBoard(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
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
    renderBoard(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
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
    const { rerender } = renderBoard(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
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
          currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
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
    renderBoard(
      <ProjectBoard
        ref={ref}
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
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

  it('opens New task from the plus with that column selected', async () => {
    const user = userEvent.setup();
    renderBoard(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
        labels={[{ id: 'l0', name: 'Design', tone: 'blue', order: 0 }]}
        columns={columns}
        members={[{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }]}
      />,
    );

    await user.click(
      within(desktopColumn('To do')).getByRole('button', { name: 'Add card to To do' }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('In Sprint board · To do')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'To do', pressed: true }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled();
  });

  it('appends a created card at the end of the chosen column', async () => {
    const user = userEvent.setup();
    createCard.mockResolvedValue({
      data: {
        id: 'card-new',
        title: 'New work',
        description: null,
        code: 'SB-4',
        order: 3,
        columnId: 'column-doing',
        dueDate: null,
        labelId: 'l0',
        assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
      },
    });
    renderBoard(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
        labels={[{ id: 'l0', name: 'Design', tone: 'blue', order: 0 }]}
        columns={columns}
        members={[{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }]}
      />,
    );

    await user.click(
      within(desktopColumn('To do')).getByRole('button', { name: 'Add card to To do' }),
    );
    await user.type(screen.getByLabelText('Title'), 'New work');
    await user.click(screen.getByRole('button', { name: 'Doing' }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          columnId: 'column-doing',
          title: 'New work',
        }),
      );
    });
    expect(cardTitlesInColumn('Doing')).toEqual(['Card C', 'New work']);
    expect(within(desktopColumn('Doing')).getByText('SB-4')).toBeInTheDocument();
  });

  it('opens the card detail when a board card is clicked', async () => {
    const user = userEvent.setup();
    renderBoard(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    await user.click(within(desktopColumn('To do')).getByRole('heading', { name: 'Card A' }));

    expect(screen.getByLabelText('Title')).toHaveValue('Card A');
    expect(screen.getByRole('dialog')).toHaveTextContent('CA-1');
  });

  it('archives a card, removes it from the board, and shows a toast', async () => {
    const user = userEvent.setup();
    renderBoard(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    await user.click(within(desktopColumn('To do')).getByRole('heading', { name: 'Card A' }));
    await user.click(screen.getAllByRole('button', { name: 'Archive task' })[0]!);

    expect(within(desktopColumn('To do')).queryByText('Card A')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Task archived');
  });

  it('narrows the board by selected labels and search text together', async () => {
    const user = userEvent.setup();
    const design = { id: 'label-design', name: 'Design', tone: 'blue' as const, order: 0 };
    const bug = { id: 'label-bug', name: 'Bug', tone: 'red' as const, order: 1 };
    renderBoard(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
        labels={[design, bug]}
        members={[{ id: 'user-ada', name: 'Ada', username: 'ada' }]}
        columns={[
          {
            id: 'column-todo',
            title: 'To do',
            order: 0,
            cards: [
              { id: 'card-a', title: 'Draw the board', code: 'CA-1', dueDate: null, label: design },
              { id: 'card-b', title: 'Fix the queue', code: 'CB-2', dueDate: null, label: bug },
            ],
          },
          { id: 'column-doing', title: 'Doing', order: 1, cards: [] },
          { id: 'column-done', title: 'Done', order: 2, cards: [] },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getAllByRole('button', { name: 'Design' })[0]!);

    expect(screen.getByRole('button', { name: 'Filters' })).toHaveTextContent('1');
    expect(within(desktopColumn('To do')).getByText('Draw the board')).toBeInTheDocument();
    expect(within(desktopColumn('To do')).queryByText('Fix the queue')).not.toBeInTheDocument();

    await user.type(screen.getAllByRole('searchbox', { name: 'Search the board' })[0]!, 'missing');
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.queryByText('Draw the board')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(within(desktopColumn('To do')).getByText('Draw the board')).toBeInTheDocument();
    expect(within(desktopColumn('To do')).getByText('Fix the queue')).toBeInTheDocument();
  });

  it('hides the card code when visibility is turned off', async () => {
    const user = userEvent.setup();
    renderBoard(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    expect(within(desktopColumn('To do')).getByText('CA-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Card visibility' }));
    await user.click(screen.getAllByRole('button', { name: 'Card code' })[0]!);

    expect(within(desktopColumn('To do')).queryByText('CA-1')).not.toBeInTheDocument();
    expect(within(desktopColumn('To do')).getByText('Card A')).toBeInTheDocument();
  });

  it('reverts a failed visibility toggle and does not leave an unpersisted face', async () => {
    updateBoardVisibility.mockResolvedValue({ error: GENERIC_ERROR_MESSAGE });
    const user = userEvent.setup();
    renderBoard(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
        labels={[]}
        columns={columns}
        members={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Card visibility' }));
    await user.click(screen.getAllByRole('button', { name: 'Card code' })[0]!);

    await waitFor(() => {
      expect(within(desktopColumn('To do')).getByText('CA-1')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: 'Card code' })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
  });

  it('closes filters when a card detail modal opens', async () => {
    const user = userEvent.setup();
    renderBoard(
      <ProjectBoard
        title="Sprint board"
        projectId="project-1"
        currentUser={{ id: 'user-ada', name: 'Ada', username: 'ada' }}
        labels={[{ id: 'label-design', name: 'Design', tone: 'blue', order: 0 }]}
        columns={columns}
        members={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getAllByRole('dialog', { name: 'Filters' }).length).toBeGreaterThan(0);

    await user.click(within(desktopColumn('To do')).getByRole('heading', { name: 'Card A' }));
    expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Card A');
  });
});
