// tests/components/boards/BoardsEmptyState.test.tsx
//
// Tests for the boards empty state.
//
// Tested:
// - Shows the empty copy when there are no boards
//
// What is covered:
// - Empty list messaging
//
// Run with: pnpm test:run tests/components/boards/BoardsEmptyState.test.tsx
//
// SEE: src/components/boards/BoardsEmptyState.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import BoardsEmptyState from '@/components/boards/BoardsEmptyState';

describe('BoardsEmptyState', () => {
  it('shows the empty copy when there are no boards', () => {
    render(<BoardsEmptyState />);

    expect(
      screen.getByText('You have no boards yet. Create one to get started.'),
    ).toBeInTheDocument();
  });
});
