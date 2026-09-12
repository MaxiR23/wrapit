// tests/components/projects/ProjectsLoading.test.tsx
//
// Tests for the projects-grid loading placeholder.
//
// Tested:
// - Renders a busy status region with a card grid
// - Does not render sidebar or tab bar chrome
//
// What is covered:
// - Shape landmarks. jsdom cannot prove Next swaps this file in as the
//   route loading fallback, or that nothing shifts when the page arrives.
//
// Run with: pnpm test:run tests/components/projects/ProjectsLoading.test.tsx
//
// SEE: src/components/projects/ProjectsLoading.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ProjectsLoading from '@/components/projects/ProjectsLoading';
import Loading from '@/app/(app)/projects/loading';

describe('ProjectsLoading', () => {
  it('renders a card grid inside a status region and omits shell chrome', () => {
    const { container } = render(<ProjectsLoading />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('[data-slot="screen-header"]')).not.toBeNull();
    expect(screen.getByRole('list').children).toHaveLength(6);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('is what the projects loading route file renders', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
