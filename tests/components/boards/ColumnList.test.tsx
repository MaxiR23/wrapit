// tests/components/boards/ColumnList.test.tsx
//
// Tests for the column list.
//
// Tested:
// - Renders column titles in the given order
// - Labels each delete button with the column title
// - Requires confirmation before calling deleteColumn
// - Cancel leaves the column in place
// - Disables confirm while pending and only closes on success
//
// What is covered:
// - Render, accessible delete labels, and confirm-delete interaction
//
// Run with: pnpm test:run tests/components/boards/ColumnList.test.tsx
//
// SEE: src/components/boards/ColumnList.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deleteColumn = vi.fn();

vi.mock('@/actions/deleteColumn', () => ({
  deleteColumn,
}));

vi.mock('@/components/cards/CardList', () => ({
  default: () => <p>Cards placeholder</p>,
}));

vi.mock('@/components/cards/NewCardDialog', () => ({
  default: ({ columnTitle }: { columnTitle: string }) => (
    <button type="button" aria-label={`New card in ${columnTitle}`}>
      New card
    </button>
  ),
}));

const { default: ColumnList } = await import('@/components/boards/ColumnList');

const columns = [
  { id: 'column-1', title: 'To do', cards: [] },
  { id: 'column-2', title: 'Done', cards: [] },
];

describe('ColumnList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteColumn.mockResolvedValue({ data: { id: 'column-1' } });
  });

  it('renders column titles in the given order', () => {
    render(<ColumnList columns={columns} />);

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent('To do');
    expect(headings[1]).toHaveTextContent('Done');
  });

  it('labels each delete button with the column title', () => {
    render(<ColumnList columns={columns} />);

    expect(screen.getByRole('button', { name: 'Delete column To do' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete column Done' })).toBeInTheDocument();
  });

  it('requires confirmation before calling deleteColumn', async () => {
    const user = userEvent.setup();
    render(<ColumnList columns={[{ id: 'column-1', title: 'To do', cards: [] }]} />);

    await user.click(screen.getByRole('button', { name: 'Delete column To do' }));

    expect(deleteColumn).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Delete column' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm delete column To do' }));

    expect(deleteColumn).toHaveBeenCalledWith({ columnId: 'column-1' });
  });

  it('does not delete when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ColumnList columns={[{ id: 'column-1', title: 'To do', cards: [] }]} />);

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
    render(<ColumnList columns={[{ id: 'column-1', title: 'To do', cards: [] }]} />);

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

    resolveDelete({ data: { id: 'column-1' } });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete column' })).not.toBeInTheDocument();
    });
  });
});
