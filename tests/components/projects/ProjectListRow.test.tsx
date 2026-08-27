// tests/components/projects/ProjectListRow.test.tsx
//
// Tests for the projects list row star control.
//
// Tested:
// - Star button calls onToggle with the next starred value
// - Clicking the star does not activate the project link
//
// What is covered:
// - Presentational star toggle on the list row
//
// Run with: pnpm test:run tests/components/projects/ProjectListRow.test.tsx
//
// SEE: src/components/projects/ProjectListRow.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProjectListRow from '@/components/projects/ProjectListRow';
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
  canAdminister: true,
  members: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
};

describe('ProjectListRow', () => {
  it('calls onToggle with the next starred value', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ProjectListRow project={project} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: 'Star project' }));

    expect(onToggle).toHaveBeenCalledWith('project-1', true);
  });

  it('does not navigate when the star is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ProjectListRow project={project} onToggle={onToggle} />);

    const link = screen.getByRole('link', { name: /Sprint board/ });
    const onLinkClick = vi.fn();
    link.addEventListener('click', onLinkClick);

    await user.click(screen.getByRole('button', { name: 'Star project' }));

    expect(onLinkClick).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith('project-1', true);
  });
});
