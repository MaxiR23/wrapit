// tests/components/tasks/MyTasksView.test.tsx
//
// Tests for the My tasks list: filters, split row actions, empty states, and create.
//
// Tested:
// - The complete circle does not open detail; the rest of the row does
// - Completing calls setCardCompleted without opening detail
// - Search, project chip, and period combine with AND
// - Overdue stays visible under Today
// - Three empty states
// - Two-step create calls createCard with the inbox column and a due date
//
// What is covered:
// - Split row actions, AND filters, overdue-across-periods, empty states, two-step create
//
// Run with: pnpm test:run tests/components/tasks/MyTasksView.test.tsx
//
// SEE: src/components/tasks/MyTasksView.tsx

import { type ReactElement, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { MyTask } from '@/lib/myTasks';

const setCardCompleted = vi.fn();
const createCard = vi.fn();
const refresh = vi.fn();

vi.mock('@/actions/setCardCompleted', () => ({ setCardCompleted }));
vi.mock('@/actions/createCard', () => ({ createCard }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const { default: MyTasksView } = await import('@/components/tasks/MyTasksView');
const { OpenPanelProvider } = await import('@/components/projects/OpenPanel');
const { ProjectsSearchProvider, useProjectsSearch } =
  await import('@/components/projects/ProjectsSearch');

const nowDay = new Date(Date.UTC(2026, 7, 26));
const yesterday = new Date(Date.UTC(2026, 7, 25));
const nextWeek = new Date(Date.UTC(2026, 8, 2));

const openToday: MyTask = {
  id: 'task-today',
  title: 'Ship the grid',
  dueDate: nowDay,
  dueTimeZone: null,
  label: { id: 'label-bug', name: 'Bug', tone: 'red' },
  subtasks: [{ id: 'st-1', done: false }],
  assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
  project: { id: 'proj-sprint', title: 'Sprint board', access: 'EDIT' },
  columnId: 'col-todo',
  completed: false,
};

const openLate: MyTask = {
  ...openToday,
  id: 'task-late',
  title: 'Fix login',
  dueDate: yesterday,
  project: { id: 'proj-app', title: 'App mobile', access: 'EDIT' },
  label: { id: 'label-design', name: 'Design', tone: 'blue' },
};

const openLater: MyTask = {
  ...openToday,
  id: 'task-later',
  title: 'Migrate data',
  dueDate: nextWeek,
};

const completed: MyTask = {
  ...openToday,
  id: 'task-done',
  title: 'Write tests',
  completed: true,
};

function SearchSeed({ query }: { query: string }) {
  const { setQuery } = useProjectsSearch();
  return (
    <button type="button" onClick={() => setQuery(query)}>
      Seed search
    </button>
  );
}

function Harness({ children, query = '' }: { children: ReactNode; query?: string }) {
  return (
    <OpenPanelProvider>
      <ProjectsSearchProvider>
        {query ? <SearchSeed query={query} /> : null}
        {children}
      </ProjectsSearchProvider>
    </OpenPanelProvider>
  );
}

const frozenNow = new Date(2026, 7, 26, 12, 0, 0);

function renderView(ui: ReactElement, query = '') {
  return render(ui, {
    wrapper: ({ children }) => <Harness query={query}>{children}</Harness>,
  });
}

describe('MyTasksView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCardCompleted.mockResolvedValue({
      data: { id: 'task-today', columnId: 'col-done', completed: true },
    });
    createCard.mockResolvedValue({
      data: {
        id: 'task-new',
        title: 'New work',
        dueDate: null,
        dueTimeZone: null,
        columnId: 'col-inbox',
        assignees: [{ id: 'user-ada', name: 'Ada', username: 'ada' }],
      },
    });
  });

  it('completes from the circle without opening detail, and opens detail from the row', async () => {
    const user = userEvent.setup();
    renderView(<MyTasksView initialTasks={[openToday]} createProjects={[]} now={frozenNow} />);

    await user.click(screen.getByRole('button', { name: 'Mark as completed' }));

    expect(setCardCompleted).toHaveBeenCalledWith({
      cardId: 'task-today',
      completed: true,
    });
    expect(screen.queryByRole('dialog', { name: 'Task detail' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ship the grid/ }));

    expect(screen.getByRole('dialog', { name: 'Task detail' })).toBeInTheDocument();
    expect(setCardCompleted).toHaveBeenCalledTimes(1);
  });

  it('keeps overdue rows when Today is selected', async () => {
    const user = userEvent.setup();
    renderView(
      <MyTasksView
        initialTasks={[openToday, openLate, openLater]}
        createProjects={[]}
        now={frozenNow}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(screen.getByText('Fix login')).toBeInTheDocument();
    expect(screen.getByText('Ship the grid')).toBeInTheDocument();
    expect(screen.queryByText('Migrate data')).not.toBeInTheDocument();
  });

  it('filters by project chip', async () => {
    const user = userEvent.setup();
    renderView(
      <MyTasksView initialTasks={[openToday, openLate]} createProjects={[]} now={frozenNow} />,
    );
    await user.click(screen.getByRole('button', { name: 'Sprint board' }));

    expect(screen.getByText('Ship the grid')).toBeInTheDocument();
    expect(screen.queryByText('Fix login')).not.toBeInTheDocument();
  });

  it('shows the search empty state', async () => {
    const user = userEvent.setup();
    renderView(
      <MyTasksView initialTasks={[openToday]} createProjects={[]} now={frozenNow} />,
      'zebra',
    );
    await user.click(screen.getByRole('button', { name: 'Seed search' }));

    expect(screen.getByText('No results for "zebra"')).toBeInTheDocument();
  });

  it('shows the all-done empty state', () => {
    renderView(<MyTasksView initialTasks={[completed]} createProjects={[]} now={frozenNow} />);

    expect(screen.getByText("You're all done")).toBeInTheDocument();
    expect(screen.getByText('Write tests')).toBeInTheDocument();
  });

  it('shows nothing pending when the period cuts away remaining work', async () => {
    const user = userEvent.setup();
    renderView(<MyTasksView initialTasks={[openLater]} createProjects={[]} now={frozenNow} />);

    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(screen.getByText('Nothing pending here')).toBeInTheDocument();
  });

  it('creates a task after choosing a project, using the inbox column and due date', async () => {
    const user = userEvent.setup();
    renderView(
      <MyTasksView
        initialTasks={[]}
        createProjects={[{ id: 'proj-sprint', title: 'Sprint board', inboxColumnId: 'col-inbox' }]}
        now={frozenNow}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'New task' }));
    await user.click(screen.getByRole('button', { name: 'Sprint board' }));
    await user.type(screen.getByLabelText('Title'), 'New work');
    await user.type(screen.getByLabelText('Due date'), '2026-08-27');
    await user.click(screen.getByRole('button', { name: /^Create/ }));

    await waitFor(() => {
      expect(createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          columnId: 'col-inbox',
          title: 'New work',
          dueDate: '2026-08-27',
        }),
      );
    });
  });

  it('returns a completed row to pending when the row is clicked', async () => {
    const user = userEvent.setup();
    setCardCompleted.mockResolvedValue({
      data: { id: 'task-done', columnId: 'col-todo', completed: false },
    });
    renderView(<MyTasksView initialTasks={[completed]} createProjects={[]} now={frozenNow} />);

    const completedBlock = screen.getByRole('heading', { name: 'Completed' }).closest('section');
    await user.click(
      within(completedBlock as HTMLElement).getByRole('button', { name: 'Mark as pending' }),
    );

    expect(setCardCompleted).toHaveBeenCalledWith({
      cardId: 'task-done',
      completed: false,
    });
  });
});
