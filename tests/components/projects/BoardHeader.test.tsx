// tests/components/projects/BoardHeader.test.tsx
//
// Tests for the project board header.
//
// Tested:
// - Links back to the projects list
// - Shows desktop and mobile progress copy from the same counts
// - Renders interactive member avatars on desktop and static ones on mobile
//
// What is covered:
// - Back link, progress labels, dual member avatars
//
// Run with: pnpm test:run tests/components/projects/BoardHeader.test.tsx
//
// SEE: src/components/projects/BoardHeader.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import BoardHeader from '@/components/projects/BoardHeader';

const members = [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }];

describe('BoardHeader', () => {
  it('links back to projects and shows both progress labels', () => {
    render(
      <BoardHeader title="Sprint board" doneCount={1} taskCount={4} percent={25} members={[]} />,
    );

    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(screen.getByText('1 of 4 cards done')).toBeInTheDocument();
    expect(screen.getByText('1/4 done')).toBeInTheDocument();
  });

  it('renders a static avatar and an interactive one for the same member', () => {
    render(
      <BoardHeader
        title="Sprint board"
        doneCount={0}
        taskCount={0}
        percent={0}
        members={members}
      />,
    );

    expect(screen.getAllByTitle('Ada Lovelace')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument();
  });
});
