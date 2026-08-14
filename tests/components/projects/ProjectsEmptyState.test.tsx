// tests/components/projects/ProjectsEmptyState.test.tsx
//
// Tests for the projects empty state.
//
// Tested:
// - Shows the empty copy when there are no projects
//
// What is covered:
// - Empty list messaging
//
// Run with: pnpm test:run tests/components/projects/ProjectsEmptyState.test.tsx
//
// SEE: src/components/projects/ProjectsEmptyState.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ProjectsEmptyState from '@/components/projects/ProjectsEmptyState';

describe('ProjectsEmptyState', () => {
  it('shows the empty copy when there are no projects', () => {
    render(<ProjectsEmptyState />);

    expect(
      screen.getByText('You have no projects yet. Create one to get started.'),
    ).toBeInTheDocument();
  });
});
