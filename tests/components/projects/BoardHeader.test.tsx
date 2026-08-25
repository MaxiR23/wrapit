// tests/components/projects/BoardHeader.test.tsx
//
// Tests for the project board header.
//
// Tested:
// - Links back to the projects list
// - Shows desktop and mobile progress copy from the same counts
// - Replaces the bar with empty copy when there are no cards
// - Renders one interactive avatar per member
// - Does not render a Labels control
//
// What is covered:
// - Back link, progress labels, empty copy, member avatars
//
// Run with: pnpm test:run tests/components/projects/BoardHeader.test.tsx
//
// SEE: src/components/projects/BoardHeader.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import BoardHeader from '@/components/projects/BoardHeader';

const members = [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }];

function renderHeader(
  props: Partial<{ title: string; doneCount: number; taskCount: number; percent: number }> & {
    members?: typeof members;
  } = {},
) {
  return render(
    <BoardHeader
      title="Sprint board"
      doneCount={0}
      taskCount={0}
      percent={0}
      members={[]}
      {...props}
    />,
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

  it('does not render a Labels control in the header', () => {
    renderHeader();

    expect(screen.queryByRole('button', { name: 'Labels' })).not.toBeInTheDocument();
  });
});
