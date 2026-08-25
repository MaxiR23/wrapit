// tests/components/projects/BoardColumn.test.tsx
//
// Tests for a board column shell.
//
// Tested:
// - Renders the uppercase title, card count, and cards
// - Leaves an empty column blank (no placeholder copy)
// - Enables the add-card control and reports the column
//
// What is covered:
// - Title, count, empty state, plus button
//
// Run with: pnpm test:run tests/components/projects/BoardColumn.test.tsx
//
// SEE: src/components/projects/BoardColumn.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BoardColumn from '@/components/projects/BoardColumn';

const cards = [
  { id: 'card-1', title: 'First', code: 'SB-1', dueDate: null },
  { id: 'card-2', title: 'Second', code: 'SB-2', dueDate: null },
];

describe('BoardColumn', () => {
  it('renders the title, count, and cards', () => {
    render(<BoardColumn columnId="column-todo" title="To do" cards={cards} />);

    expect(screen.getByRole('heading', { name: 'To do', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Second', level: 3 })).toBeInTheDocument();
  });

  it('leaves an empty column blank', () => {
    render(<BoardColumn columnId="column-todo" title="To do" cards={[]} />);

    expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'To do', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('enables the add-card control and reports the column', async () => {
    const user = userEvent.setup();
    const onAddCard = vi.fn();
    render(<BoardColumn columnId="column-todo" title="To do" cards={[]} onAddCard={onAddCard} />);

    const plus = screen.getByRole('button', { name: 'Add card to To do' });
    expect(plus).toBeEnabled();
    await user.click(plus);
    expect(onAddCard).toHaveBeenCalledWith('column-todo', plus);
  });
});
