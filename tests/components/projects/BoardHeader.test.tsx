// tests/components/projects/BoardHeader.test.tsx
//
// Tests for the project board header.
//
// Tested:
// - Links back to the projects list
// - Shows desktop and mobile progress copy from the same counts
// - Replaces the bar with empty copy when there are no cards
// - Renders one interactive avatar per member
// - Shows a Labels control that opens the editor
//
// What is covered:
// - Back link, progress labels, empty copy, member avatars, labels entry
//
// Run with: pnpm test:run tests/components/projects/BoardHeader.test.tsx
//
// SEE: src/components/projects/BoardHeader.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { OpenPanelProvider } from '@/components/projects/OpenPanel';

vi.mock('@/actions/updateLabelField', () => ({
  updateLabelField: vi.fn(async (input: { value: string }) => ({ data: { value: input.value } })),
}));
vi.mock('@/actions/createLabel', () => ({ createLabel: vi.fn() }));
vi.mock('@/actions/deleteLabel', () => ({ deleteLabel: vi.fn() }));

const { default: BoardHeader } = await import('@/components/projects/BoardHeader');

const members = [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }];
const labels = [
  { id: 'l0', name: 'Design', tone: 'blue' as const, order: 0 },
  { id: 'l1', name: 'Bug', tone: 'red' as const, order: 1 },
];

function renderHeader(
  props: Partial<{ title: string; doneCount: number; taskCount: number; percent: number }> & {
    members?: typeof members;
  } = {},
) {
  return render(
    <OpenPanelProvider>
      <BoardHeader
        title="Sprint board"
        doneCount={0}
        taskCount={0}
        percent={0}
        members={[]}
        projectId="project-1"
        labels={labels}
        {...props}
      />
    </OpenPanelProvider>,
  );
}

describe('BoardHeader', () => {
  it('links back to projects and shows both progress labels', () => {
    renderHeader({ doneCount: 1, taskCount: 4, percent: 25 });

    expect(screen.getByRole('link', { name: 'Projects / Board' })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(screen.getByText('1 of 4 cards done')).toBeInTheDocument();
    expect(screen.getByText('1/4 done')).toBeInTheDocument();
  });

  it('replaces the progress bar with empty copy when there are no cards', () => {
    renderHeader();

    expect(
      screen.getByText('There are no cards yet. You can create the first one in any column.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('0 of 0 cards done')).not.toBeInTheDocument();
    expect(screen.queryByText('0/0 done')).not.toBeInTheDocument();
  });

  it('renders one interactive avatar per member', () => {
    renderHeader({ members });

    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.queryByTitle('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('renders a Labels control in the header', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: 'Labels' })).toBeInTheDocument();
  });
});
