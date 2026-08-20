// tests/components/projects/ProjectsEmptyState.test.tsx
//
// Tests for the projects empty state, template picker, and mobile demo board.
//
// Tested:
// - Shows the empty title and subtitle when there are no projects
// - View templates opens the templates screen with all 9 catalog rows
// - Selecting a template is single-select and switches the CTA label
// - Back closes the templates screen and keeps the picked template
// - Escape closes the templates screen and restores focus to View templates
// - Creating after a pick sends that template's columns to createProject
// - Mobile demo board is in the tree (md:hidden, aria-hidden)
// - Reduced motion disables the demo animation and rests the card in To do
//
// What is covered:
// - Empty copy, template list, single selection, CTA label, back preserves
//   pick, Escape closes and restores focus, create payload columns, demo
//   board presence and reduced-motion rest position
//
// Run with: pnpm test:run tests/components/projects/ProjectsEmptyState.test.tsx
//
// SEE: src/components/projects/ProjectsEmptyState.tsx
// SEE: src/components/projects/EmptyDemoBoard.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { listProjectTemplates } from '@/lib/templates';

const createProject = vi.fn();

vi.mock('@/actions/createProject', () => ({
  createProject,
}));

const { default: ProjectsEmptyState } = await import('@/components/projects/ProjectsEmptyState');

const templateNames = listProjectTemplates().map((template) => template.name);

describe('ProjectsEmptyState', () => {
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

  it('shows the empty title and subtitle', () => {
    render(<ProjectsEmptyState />);

    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(
      screen.getByText('Pick a starting point. You can change the columns later, anytime.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create my first project' })).toBeInTheDocument();
  });

  it('opens the templates screen with all 9 catalog rows', async () => {
    const user = userEvent.setup();
    render(<ProjectsEmptyState />);

    await user.click(screen.getByRole('button', { name: 'View templates' }));

    const templatesScreen = screen.getByRole('dialog', { name: 'Templates' });
    expect(within(templatesScreen).getByText('Templates')).toBeInTheDocument();

    for (const name of templateNames) {
      expect(
        within(templatesScreen).getByRole('button', { name: new RegExp(`^${name}`) }),
      ).toBeInTheDocument();
    }
    expect(templateNames).toHaveLength(9);
  });

  it('selects a single template and switches the CTA to Create with that name', async () => {
    const user = userEvent.setup();
    render(<ProjectsEmptyState />);

    await user.click(screen.getByRole('button', { name: 'View templates' }));
    const templatesScreen = screen.getByRole('dialog', { name: 'Templates' });

    await user.click(within(templatesScreen).getByRole('button', { name: /^Product/ }));
    expect(within(templatesScreen).getByRole('button', { name: /^Product/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(templatesScreen).getByRole('button', { name: /^Blank/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      within(templatesScreen).getByRole('button', { name: 'Create with Product' }),
    ).toBeInTheDocument();

    await user.click(within(templatesScreen).getByRole('button', { name: /^Sprint/ }));
    expect(within(templatesScreen).getByRole('button', { name: /^Sprint/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(templatesScreen).getByRole('button', { name: /^Product/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      within(templatesScreen).getByRole('button', { name: 'Create with Sprint' }),
    ).toBeInTheDocument();
  });

  it('keeps the picked template when the templates screen is closed with Back', async () => {
    const user = userEvent.setup();
    render(<ProjectsEmptyState />);

    await user.click(screen.getByRole('button', { name: 'View templates' }));
    const templatesScreen = screen.getByRole('dialog', { name: 'Templates' });
    await user.click(within(templatesScreen).getByRole('button', { name: /^Product/ }));
    await user.click(within(templatesScreen).getByRole('button', { name: 'Back' }));

    expect(screen.queryByRole('dialog', { name: 'Templates' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create with Product' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View templates' }));
    expect(
      within(screen.getByRole('dialog', { name: 'Templates' })).getByRole('button', {
        name: /^Product/,
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('closes the templates screen on Escape and restores focus to View templates', async () => {
    const user = userEvent.setup();
    render(<ProjectsEmptyState />);

    const trigger = screen.getByRole('button', { name: 'View templates' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Templates' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Templates' })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('sends the picked template columns to createProject', async () => {
    const user = userEvent.setup();
    render(<ProjectsEmptyState />);

    await user.click(screen.getByRole('button', { name: 'View templates' }));
    const templatesScreen = screen.getByRole('dialog', { name: 'Templates' });
    await user.click(within(templatesScreen).getByRole('button', { name: /^Product/ }));
    await user.click(within(templatesScreen).getByRole('button', { name: 'Create with Product' }));

    expect(await screen.findByRole('dialog', { name: 'New project' })).toBeInTheDocument();
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
        invitees: [],
      });
    });
  });

  it('renders the mobile demo board in a hidden-from-tablet container', () => {
    const { container } = render(<ProjectsEmptyState />);
    const board = container.querySelector('.empty-demo-board');

    expect(board).toBeInstanceOf(HTMLElement);
    expect(board).toHaveAttribute('aria-hidden', 'true');
    expect(board).toHaveClass('md:hidden');
    expect(within(board as HTMLElement).getByText('To do')).toBeInTheDocument();
    expect(within(board as HTMLElement).getByText('In progress')).toBeInTheDocument();
    expect(within(board as HTMLElement).getByText('Done')).toBeInTheDocument();
  });

  it('disables the demo board animation under reduced motion and rests the card in To do', () => {
    const { container } = render(<ProjectsEmptyState />);
    const board = container.querySelector('.empty-demo-board');
    expect(board).toBeInstanceOf(HTMLElement);

    const animated = board!.querySelectorAll('[class*="motion-reduce:!animate-none"]');
    expect(animated.length).toBeGreaterThan(0);

    const card = board!.querySelector('.empty-demo-board-card');
    expect(card).toBeInstanceOf(HTMLElement);
    expect(card).toHaveClass('left-[14px]');
    expect(card).toHaveClass('top-[100px]');
    expect(card).not.toHaveClass('translate-x-[111.33px]');
    expect(card).not.toHaveClass('translate-x-[222.67px]');
  });
});
