// tests/components/projects/NewProjectDialog.test.tsx
//
// Tests for the new project dialog.
//
// Tested:
// - Opens the dialog and submits a title to createProject
// - Clears a stale form-level API error when resubmitting with invalid input
//
// What is covered:
// - Open and submit happy path, stale form error on invalid resubmit
//
// Run with: pnpm test:run tests/components/projects/NewProjectDialog.test.tsx
//
// SEE: src/components/projects/NewProjectDialog.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createProject = vi.fn();

vi.mock('@/actions/createProject', () => ({
  createProject,
}));

const { default: NewProjectDialog } = await import('@/components/projects/NewProjectDialog');

describe('NewProjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createProject.mockResolvedValue({
      data: {
        id: 'project-1',
        title: 'Sprint board',
        ownerId: 'user-ada',
        createdAt: new Date(),
      },
    });
  });

  it('opens the dialog and submits a title to createProject', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog />);

    await user.click(screen.getByRole('button', { name: 'New project' }));

    expect(await screen.findByRole('heading', { name: 'New project' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Sprint board');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(createProject).toHaveBeenCalledWith({ title: 'Sprint board' });
  });

  it('clears a stale form-level API error when resubmitting with invalid input', async () => {
    createProject.mockResolvedValue({ error: 'Unauthorized' });
    const user = userEvent.setup();
    render(<NewProjectDialog />);

    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Title'), 'Sprint board');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );

    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(createProject).toHaveBeenCalledTimes(1);
  });
});
