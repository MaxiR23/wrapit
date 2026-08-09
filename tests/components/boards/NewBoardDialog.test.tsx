// tests/components/boards/NewBoardDialog.test.tsx
//
// Tests for the new board dialog.
//
// Tested:
// - Opens the dialog and submits a title to createBoard
// - Clears a stale form-level API error when resubmitting with invalid input
//
// What is covered:
// - Open and submit happy path, stale form error on invalid resubmit
//
// Run with: pnpm test:run tests/components/boards/NewBoardDialog.test.tsx
//
// SEE: src/components/boards/NewBoardDialog.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createBoard = vi.fn();

vi.mock('@/actions/createBoard', () => ({
  createBoard,
}));

const { default: NewBoardDialog } = await import('@/components/boards/NewBoardDialog');

describe('NewBoardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createBoard.mockResolvedValue({
      data: {
        id: 'board-1',
        title: 'Sprint board',
        ownerId: 'user-ada',
        createdAt: new Date(),
      },
    });
  });

  it('opens the dialog and submits a title to createBoard', async () => {
    const user = userEvent.setup();
    render(<NewBoardDialog />);

    await user.click(screen.getByRole('button', { name: 'New board' }));

    expect(await screen.findByRole('heading', { name: 'New board' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Sprint board');
    await user.click(screen.getByRole('button', { name: 'Create board' }));

    expect(createBoard).toHaveBeenCalledWith({ title: 'Sprint board' });
  });

  it('clears a stale form-level API error when resubmitting with invalid input', async () => {
    createBoard.mockResolvedValue({ error: 'Unauthorized' });
    const user = userEvent.setup();
    render(<NewBoardDialog />);

    await user.click(screen.getByRole('button', { name: 'New board' }));
    await user.type(screen.getByLabelText('Title'), 'Sprint board');
    await user.click(screen.getByRole('button', { name: 'Create board' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );

    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Create board' }));

    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(createBoard).toHaveBeenCalledTimes(1);
  });
});
