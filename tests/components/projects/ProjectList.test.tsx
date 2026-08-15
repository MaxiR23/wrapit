// tests/components/projects/ProjectList.test.tsx
//
// Tests for the projects list table.
//
// Tested:
// - Renders the project name, task count, status, progress and updated label
// - Links to the project detail page
// - Keeps the star outside the row link
// - Shows 0 tasks and 0% when the project has no cards
//
// What is covered:
// - Happy path and empty-progress case
//
// Run with: pnpm test:run tests/components/projects/ProjectList.test.tsx
//
// SEE: src/components/projects/ProjectList.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ProjectList from '@/components/projects/ProjectList';
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

describe('ProjectList', () => {
  it('renders the name, progress, status and a link to the project', () => {
    render(<ProjectList projects={[project]} />);

    expect(screen.getByRole('link', { name: /Sprint board/ })).toHaveAttribute(
      'href',
      '/projects/project-1',
    );
    expect(screen.getByText('24 tasks')).toBeInTheDocument();
    expect(screen.getByText('46%')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Updated 2 hours ago')).toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });

  it('keeps the star outside the row link so it does not navigate', () => {
    render(<ProjectList projects={[project]} />);

    const link = screen.getByRole('link', { name: /Sprint board/ });
    const star = screen.getByRole('button', { name: 'Star project' });

    expect(link.contains(star)).toBe(false);
  });

  it('shows 0 tasks and 0% when there are no cards', () => {
    render(
      <ProjectList
        projects={[
          {
            ...project,
            title: 'Empty board',
            taskCount: 0,
            doneCount: 0,
            percent: 0,
            status: 'NEW',
            statusLabel: 'New',
          },
        ]}
      />,
    );

    expect(screen.getByText('0 tasks')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
