// tests/components/cards/CardsEmptyState.test.tsx
//
// Tests for the cards empty state.
//
// Tested:
// - Shows the empty copy when there are no cards
//
// What is covered:
// - Empty list messaging
//
// Run with: pnpm test:run tests/components/cards/CardsEmptyState.test.tsx
//
// SEE: src/components/cards/CardsEmptyState.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import CardsEmptyState from '@/components/cards/CardsEmptyState';

describe('CardsEmptyState', () => {
  it('shows the empty copy when there are no cards', () => {
    render(<CardsEmptyState />);

    expect(
      screen.getByText('No cards in this column yet. Create one to get started.'),
    ).toBeInTheDocument();
  });
});
