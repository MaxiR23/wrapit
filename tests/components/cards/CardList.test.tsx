// tests/components/cards/CardList.test.tsx
//
// Tests for the card list.
//
// Tested:
// - Renders card titles in the given order
// - Shows the empty state when there are no cards
//
// What is covered:
// - Render and empty state
//
// Run with: pnpm test:run tests/components/cards/CardList.test.tsx
//
// SEE: src/components/cards/CardList.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/cards/EditCardDialog', () => ({
  default: ({ title }: { title: string }) => (
    <button type="button" aria-label={`Edit card ${title}`}>
      Edit
    </button>
  ),
}));

vi.mock('@/components/cards/DeleteCardDialog', () => ({
  default: ({ title }: { title: string }) => (
    <button type="button" aria-label={`Delete card ${title}`}>
      Delete
    </button>
  ),
}));

const { default: CardList } = await import('@/components/cards/CardList');

describe('CardList', () => {
  it('renders card titles in the given order', () => {
    render(
      <CardList
        cards={[
          { id: 'card-1', title: 'First', description: null },
          { id: 'card-2', title: 'Second', description: 'Details' },
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('First');
    expect(items[1]).toHaveTextContent('Second');
    expect(items[1]).toHaveTextContent('Details');
  });

  it('shows the empty state when there are no cards', () => {
    render(<CardList cards={[]} />);

    expect(
      screen.getByText('No cards in this column yet. Create one to get started.'),
    ).toBeInTheDocument();
  });
});
