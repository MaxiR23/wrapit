// tests/components/projects/ProjectCard.test.tsx
//
// Tests for the project grid card.
//
// Tested:
// - Renders the project name, progress copy, status and updated label
// - Links to the project detail page
// - Shows 0 of 0 tasks and 0% when the project has no cards
// - Star button calls onToggle with the next starred value
// - Clicking the star does not activate the project link
//
// What is covered:
// - Happy path, empty-progress case, presentational star toggle
//
// Run with: pnpm test:run tests/components/projects/ProjectCard.test.tsx
//
// SEE: src/components/projects/ProjectCard.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProjectCard from '@/components/projects/ProjectCard';
import type { ProjectSummary } from '@/lib/projectGrid';

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

describe('ProjectCard', () => {
  it('renders the name, progress, status and a link to the project', () => {
    render(<ProjectCard project={project} />);

    expect(screen.getByRole('link', { name: /Sprint board/ })).toHaveAttribute(
      'href',
      '/projects/project-1',
    );
    expect(screen.getByText('11 of 24 tasks')).toBeInTheDocument();
    expect(screen.getByText('46%')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Updated 2 hours ago')).toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('shows 0 of 0 tasks and 0% when there are no cards', () => {
    render(
      <ProjectCard
        project={{
          ...project,
          title: 'Empty board',
          taskCount: 0,
          doneCount: 0,
          percent: 0,
          status: 'NEW',
          statusLabel: 'New',
        }}
      />,
    );

    expect(screen.getByText('0 of 0 tasks')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('calls onToggle with the next starred value', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ProjectCard project={project} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: 'Star project' }));

    expect(onToggle).toHaveBeenCalledWith('project-1', true);
  });

  it('does not navigate when the star is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ProjectCard project={project} onToggle={onToggle} />);

    const link = screen.getByRole('link', { name: /Sprint board/ });
    const onLinkClick = vi.fn();
    link.addEventListener('click', onLinkClick);

    await user.click(screen.getByRole('button', { name: 'Star project' }));

    expect(onLinkClick).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith('project-1', true);
  });
});
