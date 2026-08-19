// tests/components/projects/NewProjectDialog.test.tsx
//
// Tests for the redesigned new project dialog.
//
// Tested:
// - Create project is disabled when the name is empty or whitespace, enabled
//   when it has content
// - Submitting sends title, description, chosen status, featured, and the
//   blank template columns to createProject
// - A preselected template sends that template's columns to createProject
// - Opening with a template shows those columns as editable inputs in order
// - Renaming a column sends the edited titles with order 0..n-1
// - A blank or whitespace column name blocks submit and shows the error on
//   that row
// - The default (blank) template shows To do, In progress, and Done
// - Changing templateId while the dialog is open resets the column list
// - Status options map to NEW / IN_PROGRESS / PAUSED; default is NEW
// - Escape and backdrop click close the modal; a click inside does not
// - Opens from the default trigger and from a provided trigger
// - On success the modal closes; on a field error the message shows
//
// What is covered:
// - Submit payload including template columns, rename, per-row column
//   validation, status mapping, featured flag, close behavior, both triggers,
//   success and field-error paths
//
// Run with: pnpm test:run tests/components/projects/NewProjectDialog.test.tsx
//
// SEE: src/components/projects/NewProjectDialog.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createProject = vi.fn();

vi.mock('@/actions/createProject', () => ({
  createProject,
}));

const { default: NewProjectDialog } = await import('@/components/projects/NewProjectDialog');

async function openDialog(user: ReturnType<typeof userEvent.setup>, triggerName = 'New project') {
  await user.click(screen.getByRole('button', { name: triggerName }));
  expect(await screen.findByRole('dialog', { name: 'New project' })).toBeInTheDocument();
}

describe('NewProjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createProject.mockResolvedValue({
      data: {
        id: 'project-1',
        title: 'Sprint board',
        description: null,
        status: 'NEW',
        ownerId: 'user-ada',
        createdAt: new Date(),
      },
    });
  });

  it('disables Create project when the name is empty and enables it when filled', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog />);
    await openDialog(user);

    const create = screen.getByRole('button', { name: 'Create project' });
    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText('Name'), '   ');
    expect(create).toBeDisabled();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Sprint board');
    expect(create).toBeEnabled();
  });

  it('submits title, description, chosen status, and featured to createProject', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog />);
    await openDialog(user);

    await user.type(screen.getByLabelText('Name'), 'Sprint board');
    await user.type(screen.getByLabelText('Description'), 'Ship the kanban slice');
    await user.click(screen.getByRole('button', { name: 'In progress' }));
    await user.click(screen.getByRole('checkbox', { name: 'Mark as featured' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith({
        title: 'Sprint board',
        description: 'Ship the kanban slice',
        status: 'IN_PROGRESS',
        featured: true,
        columns: [
          { title: 'To do', order: 0 },
          { title: 'In progress', order: 1 },
          { title: 'Done', order: 2 },
        ],
      });
    });
  });

  it('sends the preselected template columns to createProject', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog templateId="product" />);
    await openDialog(user);

    await user.type(screen.getByLabelText('Name'), 'Launch board');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith({
        title: 'Launch board',
        description: '',
        status: 'NEW',
        featured: false,
        columns: [
          { title: 'Backlog', order: 0 },
          { title: 'In progress', order: 1 },
          { title: 'In review', order: 2 },
          { title: 'Done', order: 3 },
        ],
      });
    });
  });

  it('shows the product template columns as editable inputs in order', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog templateId="product" />);
    await openDialog(user);

    expect(screen.getByLabelText('Column 1')).toHaveValue('Backlog');
    expect(screen.getByLabelText('Column 2')).toHaveValue('In progress');
    expect(screen.getByLabelText('Column 3')).toHaveValue('In review');
    expect(screen.getByLabelText('Column 4')).toHaveValue('Done');
  });

  it('sends renamed columns with order 0..n-1 to createProject', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog templateId="product" />);
    await openDialog(user);

    await user.type(screen.getByLabelText('Name'), 'Launch board');
    await user.clear(screen.getByLabelText('Column 1'));
    await user.type(screen.getByLabelText('Column 1'), 'Ideas');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith({
        title: 'Launch board',
        description: '',
        status: 'NEW',
        featured: false,
        columns: [
          { title: 'Ideas', order: 0 },
          { title: 'In progress', order: 1 },
          { title: 'In review', order: 2 },
          { title: 'Done', order: 3 },
        ],
      });
    });
  });

  it('blocks submit and shows an error on a blank column name', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog templateId="product" />);
    await openDialog(user);

    await user.type(screen.getByLabelText('Name'), 'Launch board');
    await user.clear(screen.getByLabelText('Column 2'));
    await user.type(screen.getByLabelText('Column 2'), '   ');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Column 2')).toHaveAttribute('aria-invalid', 'true');
    expect(createProject).not.toHaveBeenCalled();
  });

  it('shows the blank template columns as editable inputs', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog />);
    await openDialog(user);

    expect(screen.getByLabelText('Column 1')).toHaveValue('To do');
    expect(screen.getByLabelText('Column 2')).toHaveValue('In progress');
    expect(screen.getByLabelText('Column 3')).toHaveValue('Done');
    expect(screen.queryByLabelText('Column 4')).not.toBeInTheDocument();
  });

  it('resets the column list when templateId changes while open', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<NewProjectDialog templateId="product" />);
    await openDialog(user);

    expect(screen.getByLabelText('Column 1')).toHaveValue('Backlog');
    expect(screen.getByLabelText('Column 4')).toHaveValue('Done');

    rerender(<NewProjectDialog templateId="sprint" />);

    expect(screen.getByLabelText('Column 1')).toHaveValue('Backlog');
    expect(screen.getByLabelText('Column 3')).toHaveValue('Review');
    expect(screen.getByLabelText('Column 4')).toHaveValue('Demo');
    expect(screen.getByLabelText('Column 5')).toHaveValue('Done');
  });

  it('maps status options to the createProject enums and defaults to NEW', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog />);
    await openDialog(user);

    expect(screen.getByRole('button', { name: /^New$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'In progress' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Paused' })).toHaveAttribute('aria-pressed', 'false');

    await user.type(screen.getByLabelText('Name'), 'Sprint board');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'NEW', featured: false }),
      );
    });

    await openDialog(user);
    await user.type(screen.getByLabelText('Name'), 'Paused board');
    await user.click(screen.getByRole('button', { name: 'Paused' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(createProject).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PAUSED' }));
    });
  });

  it('closes on Escape and backdrop click, but not on a click inside the dialog', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog />);
    await openDialog(user);

    await user.click(screen.getByLabelText('Name'));
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New project' })).not.toBeInTheDocument();
    });

    await openDialog(user);
    await user.click(document.querySelector('[data-slot="dialog-overlay"]')!);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New project' })).not.toBeInTheDocument();
    });
  });

  it('opens from the default trigger and from a provided trigger', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<NewProjectDialog />);
    await openDialog(user);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    unmount();

    render(
      <NewProjectDialog>
        <button type="button" aria-label="New project">
          +
        </button>
      </NewProjectDialog>,
    );
    await openDialog(user);
    expect(screen.getByRole('dialog', { name: 'New project' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
  });

  it('closes the modal on success and shows a field error from the action', async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog />);
    await openDialog(user);

    await user.type(screen.getByLabelText('Name'), 'Sprint board');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New project' })).not.toBeInTheDocument();
    });

    createProject.mockResolvedValueOnce({ fieldErrors: { title: 'Title is required' } });
    await openDialog(user);
    await user.type(screen.getByLabelText('Name'), 'Sprint board');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument();
  });
});
