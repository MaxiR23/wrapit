// tests/components/cards/NewCardDialog.test.tsx
//
// Tests for the new task dialog.
//
// Tested:
// - Shows the project and column in the desktop subtitle
// - Disables create without a title
// - Submits title, description, column, label, due date, and assignees
// - Omits assigneeIds when nobody is picked
// - Closing discards the draft
// - Escape closes the dialog
// - The pencil opens the label editor
//
// What is covered:
// - Chrome, disabled create, submit payload, discard, Escape, inline labels
//
// Run with: pnpm test:run tests/components/cards/NewCardDialog.test.tsx
//
// SEE: src/components/cards/NewCardDialog.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createCard = vi.fn();

vi.mock('@/actions/createCard', () => ({
  createCard,
}));
vi.mock('@/actions/updateLabelField', () => ({
  updateLabelField: vi.fn(async (input: { value: string }) => ({ data: { value: input.value } })),
}));
vi.mock('@/actions/createLabel', () => ({ createLabel: vi.fn() }));
vi.mock('@/actions/deleteLabel', () => ({ deleteLabel: vi.fn() }));

const { default: NewCardDialog } = await import('@/components/cards/NewCardDialog');

const columns = [
  { id: 'column-todo', title: 'To do' },
  { id: 'column-doing', title: 'In progress' },
];
const members = [
  { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
  { id: 'user-max', name: 'Maxi', username: 'maxi' },
];
const labels = [
  { id: 'l0', name: 'Design', tone: 'blue' as const, order: 0 },
  { id: 'l1', name: 'Bug', tone: 'red' as const, order: 1 },
];

function renderDialog(
  props: Partial<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
    initialColumnId: string;
  }> = {},
) {
  const onOpenChange = props.onOpenChange ?? vi.fn();
  const onCreated = props.onCreated ?? vi.fn();
  return {
    onOpenChange,
    onCreated,
    ...render(
      <NewCardDialog
        open={props.open ?? true}
        onOpenChange={onOpenChange}
        projectId="project-1"
        projectTitle="Sprint board"
        initialColumnId={props.initialColumnId ?? 'column-todo'}
        columns={columns}
        members={members}
        labels={labels}
        onLabelsChange={vi.fn()}
        onCreated={onCreated}
      />,
    ),
  };
}

describe('NewCardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCard.mockResolvedValue({
      data: {
        id: 'card-1',
        title: 'Write tests',
        description: 'Cover ownership',
        code: 'SB-1',
        order: 1,
        columnId: 'column-todo',
        dueDate: new Date(Date.UTC(2026, 7, 25)),
        labelId: 'l0',
        assignees: [{ id: 'user-max', name: 'Maxi', username: 'maxi' }],
      },
    });
  });

  it('shows the project and target column in the subtitle', () => {
    renderDialog();

    expect(screen.getAllByRole('heading', { name: 'New task' }).length).toBeGreaterThan(0);
    expect(screen.getByText('In Sprint board · To do')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('disables create without a title', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('submits the chosen column, label, due date, and assignees', async () => {
    const user = userEvent.setup();
    const { onCreated } = renderDialog();

    await user.type(screen.getByLabelText('Title'), 'Write tests');
    await user.type(screen.getByLabelText('Description'), 'Cover ownership');
    await user.click(screen.getByRole('button', { name: 'In progress' }));
    await user.click(screen.getByRole('button', { name: 'Maxi' }));
    await user.type(screen.getByLabelText('Due date'), '2026-08-25');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(createCard).toHaveBeenCalledWith({
        columnId: 'column-doing',
        title: 'Write tests',
        description: 'Cover ownership',
        labelId: 'l0',
        dueDate: '2026-08-25',
        assigneeIds: ['user-max'],
      });
    });
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'card-1',
        title: 'Write tests',
        columnId: 'column-todo',
      }),
    );
  });

  it('omits assigneeIds when nobody is picked', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText('Title'), 'Solo');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(createCard).toHaveBeenCalledWith({
        columnId: 'column-todo',
        title: 'Solo',
        description: '',
        labelId: 'l0',
      });
    });
    expect(createCard.mock.calls[0]?.[0]).not.toHaveProperty('assigneeIds');
  });

  it('discards the draft when the dialog closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = renderDialog({ onOpenChange });

    await user.type(screen.getByLabelText('Title'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <NewCardDialog
        open={false}
        onOpenChange={onOpenChange}
        projectId="project-1"
        projectTitle="Sprint board"
        initialColumnId="column-todo"
        columns={columns}
        members={members}
        labels={labels}
        onLabelsChange={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    rerender(
      <NewCardDialog
        open
        onOpenChange={onOpenChange}
        projectId="project-1"
        projectTitle="Sprint board"
        initialColumnId="column-todo"
        columns={columns}
        members={members}
        labels={labels}
        onLabelsChange={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens the label editor from the pencil', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Edit labels' }));
    expect(screen.getByText('Edit the name, click the color to change it')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});
