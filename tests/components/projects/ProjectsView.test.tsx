// tests/components/projects/ProjectsView.test.tsx
//
// Tests for the projects grid/list toggle and the mobile list fallback.
//
// Tested:
// - Defaults to the card grid
// - Switching to list shows the table on md+ and cards below md
// - Switching back to grid hides the table
//
// What is covered:
// - Client-side view toggle, mobile card fallback
//
// Run with: pnpm test:run tests/components/projects/ProjectsView.test.tsx
//
// SEE: src/components/projects/ProjectsView.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ProjectSummary } from '@/lib/projectGrid';

vi.mock('@/actions/createProject', () => ({
  createProject: vi.fn(),
}));

const { default: ProjectsView } = await import('@/components/projects/ProjectsView');

const project: ProjectSummary = {
  id: 'project-1',
  title: 'Sprint board',
  status: 'IN_PROGRESS',
  statusLabel: 'In progress',
  taskCount: 24,
  doneCount: 11,
  percent: 46,
  updatedLabel: 'Updated 2 hours ago',
  starred: false,
  members: [{ id: 'user-ada', name: 'Ada Lovelace', initials: 'AL' }],
};

describe('ProjectsView', () => {
  it('defaults to the grid with one link per project', () => {
    render(<ProjectsView projects={[project]} />);

    expect(screen.getByRole('link', { name: /Sprint board/ })).toHaveAttribute(
      'href',
      '/projects/project-1',
    );
    expect(screen.queryByText('24 tasks')).not.toBeInTheDocument();
    expect(screen.getByText('11 of 24 tasks')).toBeInTheDocument();
  });

  it('switches to the list table and keeps a card grid for mobile', async () => {
    const user = userEvent.setup();
    render(<ProjectsView projects={[project]} />);

    await user.click(screen.getByRole('button', { name: 'List' }));

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('24 tasks')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('11 of 24 tasks')).toBeInTheDocument();

    const list = screen.getByText('Project').closest('.hidden');
    expect(list).toHaveClass('hidden', 'md:block');

    const mobileGrid = screen.getByText('11 of 24 tasks').closest('.md\\:hidden');
    expect(mobileGrid).toHaveClass('md:hidden');
  });

  it('returns to the grid when Grid is pressed', async () => {
    const user = userEvent.setup();
    render(<ProjectsView projects={[project]} />);

    await user.click(screen.getByRole('button', { name: 'List' }));
    await user.click(screen.getByRole('button', { name: 'Grid' }));

    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('24 tasks')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sprint board/ })).toBeInTheDocument();
  });
});
