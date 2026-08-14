// tests/components/projects/ColumnsEmptyState.test.tsx
//
// Tests for the columns empty state.
//
// Tested:
// - Shows the empty copy when there are no columns
//
// What is covered:
// - Empty list messaging
//
// Run with: pnpm test:run tests/components/projects/ColumnsEmptyState.test.tsx
//
// SEE: src/components/projects/ColumnsEmptyState.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ColumnsEmptyState from '@/components/projects/ColumnsEmptyState';

describe('ColumnsEmptyState', () => {
  it('shows the empty copy when there are no columns', () => {
    render(<ColumnsEmptyState />);

    expect(
      screen.getByText('This project has no columns yet. Create one to get started.'),
    ).toBeInTheDocument();
  });
});
