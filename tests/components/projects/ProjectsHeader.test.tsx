// tests/components/projects/ProjectsHeader.test.tsx
//
// Tests for the projects screen header count label and new-project trigger.
//
// Tested:
// - Shows "1 project" for a single project
// - Shows "N projects" for zero and many
// - Opens the existing new-project dialog from the New project button
//
// What is covered:
// - Pluralization of the count label, create-project trigger
//
// Run with: pnpm test:run tests/components/projects/ProjectsHeader.test.tsx
//
// SEE: src/components/projects/ProjectsHeader.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/actions/createProject', () => ({
  createProject: vi.fn(),
}));

const { default: ProjectsHeader } = await import('@/components/projects/ProjectsHeader');

describe('ProjectsHeader', () => {
  it('shows 1 project when there is a single project', () => {
    render(<ProjectsHeader count={1} />);

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('1 project')).toBeInTheDocument();
  });

  it('pluralizes the count for zero and many', () => {
    const { rerender } = render(<ProjectsHeader count={0} />);
    expect(screen.getByText('0 projects')).toBeInTheDocument();

    rerender(<ProjectsHeader count={11} />);
    expect(screen.getByText('11 projects')).toBeInTheDocument();
  });

  it('opens the new project dialog from the New project button', async () => {
    const user = userEvent.setup();
    render(<ProjectsHeader count={1} />);

    await user.click(screen.getByRole('button', { name: 'New project' }));

    expect(await screen.findByRole('heading', { name: 'New project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });
});
