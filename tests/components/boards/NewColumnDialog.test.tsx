// tests/components/boards/NewColumnDialog.test.tsx
//
// Tests for the new column dialog.
//
// Tested:
// - Opens the dialog and submits a title to createColumn
// - Clears a stale form-level API error when resubmitting with invalid input
//
// What is covered:
// - Open and submit happy path, stale form error on invalid resubmit
//
// Run with: pnpm test:run tests/components/boards/NewColumnDialog.test.tsx
//
// SEE: src/components/boards/NewColumnDialog.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createColumn = vi.fn();

vi.mock('@/actions/createColumn', () => ({
  createColumn,
}));

const { default: NewColumnDialog } = await import('@/components/boards/NewColumnDialog');

describe('NewColumnDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createColumn.mockResolvedValue({
      data: {
        id: 'column-1',
        title: 'To do',
        order: 1,
        boardId: 'board-1',
      },
    });
  });

  it('opens the dialog and submits a title to createColumn', async () => {
    const user = userEvent.setup();
    render(<NewColumnDialog boardId="board-1" />);

    await user.click(screen.getByRole('button', { name: 'New column' }));

    expect(await screen.findByRole('heading', { name: 'New column' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'To do');
    await user.click(screen.getByRole('button', { name: 'Create column' }));

    expect(createColumn).toHaveBeenCalledWith({ boardId: 'board-1', title: 'To do' });
  });

  it('clears a stale form-level API error when resubmitting with invalid input', async () => {
    createColumn.mockResolvedValue({ error: 'Unauthorized' });
    const user = userEvent.setup();
    render(<NewColumnDialog boardId="board-1" />);

    await user.click(screen.getByRole('button', { name: 'New column' }));
    await user.type(screen.getByLabelText('Title'), 'To do');
    await user.click(screen.getByRole('button', { name: 'Create column' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );

    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Create column' }));

    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(createColumn).toHaveBeenCalledTimes(1);
  });
});
