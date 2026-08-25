// tests/components/cards/CardDetailDialog.test.tsx
//
// Tests for the card detail dialog.
//
// Tested:
// - Opens with the card title, code, and column
// - Disables comment submit while the composer is empty
// - Delete confirmation replaces archive and delete
// - Archive and confirmed delete call the parent handlers
//
// What is covered:
// - Chrome, composer disabled state, inline delete confirm, archive/delete
//
// Run with: pnpm test:run tests/components/cards/CardDetailDialog.test.tsx
//
// SEE: src/components/cards/CardDetailDialog.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BoardCardData, BoardMember } from '@/components/projects/boardTypes';

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

const { default: CardDetailDialog } = await import('@/components/cards/CardDetailDialog');

const currentUser: BoardMember = { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' };

const card: BoardCardData = {
  id: 'card-1',
  title: 'Write the board',
  code: 'WB-1',
  description: 'Cover ownership',
  dueDate: null,
  comments: [],
  subtasks: [],
  assignees: [currentUser],
  label: { id: 'l0', name: 'Design', tone: 'blue' },
};

function renderDialog(
  props: Partial<{
    onArchive: () => void;
    onDelete: () => void;
    onOpenChange: (open: boolean) => void;
  }> = {},
) {
  const onArchive = props.onArchive ?? vi.fn();
  const onDelete = props.onDelete ?? vi.fn();
  const onOpenChange = props.onOpenChange ?? vi.fn();
  return {
    onArchive,
    onDelete,
    onOpenChange,
    ...render(
      <CardDetailDialog
        open
        onOpenChange={onOpenChange}
        card={card}
        columnId="column-todo"
        columns={[
          { id: 'column-todo', title: 'To do' },
          { id: 'column-doing', title: 'Doing' },
        ]}
        members={[currentUser]}
        labels={[{ id: 'l0', name: 'Design', tone: 'blue', order: 0 }]}
        currentUser={currentUser}
        onCardPatch={vi.fn()}
        onMoveColumn={vi.fn()}
        onArchive={onArchive}
        onDelete={onDelete}
      />,
    ),
  };
}

describe('CardDetailDialog', () => {
  it('shows the title, code, and column', () => {
    renderDialog();

    expect(screen.getByLabelText('Title')).toHaveValue('Write the board');
    expect(screen.getByText('WB-1')).toBeInTheDocument();
    expect(screen.getAllByText('To do').length).toBeGreaterThan(0);
  });

  it('disables comment submit while the composer is empty', () => {
    renderDialog();

    expect(screen.getAllByRole('button', { name: 'Comment' })[0]).toBeDisabled();
  });

  it('replaces archive and delete with a confirmation block', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getAllByRole('button', { name: 'Delete task' })[0]!);

    expect(
      screen.getAllByText('This deletes the task and its comments. This cannot be undone.').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Archive task' })).not.toBeInTheDocument();
  });

  it('archives from the properties column', async () => {
    const user = userEvent.setup();
    const { onArchive } = renderDialog();

    await user.click(screen.getAllByRole('button', { name: 'Archive task' })[0]!);

    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('deletes after confirmation', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderDialog();

    await user.click(screen.getAllByRole('button', { name: 'Delete task' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]!);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
