// tests/components/boards/ColumnList.test.tsx
//
// Tests for the column list.
//
// Tested:
// - Renders column titles in the given order
// - Labels each delete button with the column title
// - Calls deleteColumn when Delete is clicked
//
// What is covered:
// - Render, accessible delete labels, and delete interaction
//
// Run with: pnpm test:run tests/components/boards/ColumnList.test.tsx
//
// SEE: src/components/boards/ColumnList.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deleteColumn = vi.fn();

vi.mock('@/actions/deleteColumn', () => ({
  deleteColumn,
}));

const { default: ColumnList } = await import('@/components/boards/ColumnList');

describe('ColumnList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteColumn.mockResolvedValue({ data: { id: 'column-1' } });
  });

  it('renders column titles in the given order', () => {
    render(
      <ColumnList
        columns={[
          { id: 'column-1', title: 'To do' },
          { id: 'column-2', title: 'Done' },
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('To do');
    expect(items[1]).toHaveTextContent('Done');
  });

  it('labels each delete button with the column title', () => {
    render(
      <ColumnList
        columns={[
          { id: 'column-1', title: 'To do' },
          { id: 'column-2', title: 'Done' },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete column To do' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete column Done' })).toBeInTheDocument();
  });

  it('calls deleteColumn when Delete is clicked', async () => {
    const user = userEvent.setup();
    render(<ColumnList columns={[{ id: 'column-1', title: 'To do' }]} />);

    await user.click(screen.getByRole('button', { name: 'Delete column To do' }));

    expect(deleteColumn).toHaveBeenCalledWith({ columnId: 'column-1' });
  });
});
