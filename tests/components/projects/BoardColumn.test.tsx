// tests/components/projects/BoardColumn.test.tsx
//
// Tests for a board column shell.
//
// Tested:
// - Renders the uppercase title, card count, and cards
// - Shows the empty copy when there are no cards
// - Leaves the add-card control inert
//
// What is covered:
// - Title, count, empty state, inert plus
//
// Run with: pnpm test:run tests/components/projects/BoardColumn.test.tsx
//
// SEE: src/components/projects/BoardColumn.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

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

  it('shows the empty copy when there are no cards', () => {
    render(<BoardColumn columnId="column-todo" title="To do" cards={[]} />);

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('leaves the add-card control inert', () => {
    render(<BoardColumn columnId="column-todo" title="To do" cards={[]} />);

    expect(screen.getByRole('button', { name: 'Add card to To do' })).toBeDisabled();
  });
});
