// tests/components/archived/ArchivedLoading.test.tsx
//
// Tests for the archived loading placeholder.
//
// Tested:
// - Renders a busy status region with a bordered list block
// - Does not render sidebar or tab bar chrome
// - Is what both archived loading route files render
//
// What is covered:
// - Shape landmarks. jsdom cannot prove Next swaps these files in as the
//   route loading fallback.
//
// Run with: pnpm test:run tests/components/archived/ArchivedLoading.test.tsx
//
// SEE: src/components/archived/ArchivedLoading.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ArchivedLoading from '@/components/archived/ArchivedLoading';
import ArchivedProjectsLoading from '@/app/(app)/archived/loading';
import ProjectArchivedLoading from '@/app/(app)/projects/[projectId]/archived/loading';

describe('ArchivedLoading', () => {
  it('renders a bordered list block inside a status region and omits shell chrome', () => {
    const { container } = render(<ArchivedLoading />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('[data-slot="screen-header"]')).not.toBeNull();
    expect(container.querySelector('.rounded-\\[10px\\].border.bg-card')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('is what both archived loading route files render', () => {
    const projects = render(<ArchivedProjectsLoading />);
    const project = render(<ProjectArchivedLoading />);
    expect(projects.container.querySelector('[role="status"]')).not.toBeNull();
    expect(project.container.querySelector('[role="status"]')).not.toBeNull();
  });
});
