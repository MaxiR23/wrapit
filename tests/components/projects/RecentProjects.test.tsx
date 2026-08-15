// tests/components/projects/RecentProjects.test.tsx
//
// Tests for the recents chips row.
//
// Tested:
// - Renders up to the given recents, most recent first, as links
// - Does not render when there are no recents
//
// What is covered:
// - Chip row happy path and empty case
//
// Run with: pnpm test:run tests/components/projects/RecentProjects.test.tsx
//
// SEE: src/components/projects/RecentProjects.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import RecentProjects from '@/components/projects/RecentProjects';
import type { ProjectSummary } from '@/lib/projectGrid';

function summary(id: string, title: string, percent: number): ProjectSummary {
  return {
    id,
    title,
    status: 'IN_PROGRESS',
    statusLabel: 'In progress',
    taskCount: 10,
    doneCount: percent / 10,
    percent,
    updatedLabel: 'Updated just now',
    starred: false,
    members: [{ id: 'user-ada', name: 'Ada Lovelace', initials: 'AL' }],
  };
}

describe('RecentProjects', () => {
  it('renders chips in the given order with title and percent', () => {
    render(
      <RecentProjects
        projects={[
          summary('project-a', 'Newest board', 80),
          summary('project-b', 'Older board', 20),
        ]}
      />,
    );

    expect(screen.getByText('Recents')).toBeInTheDocument();
    const chips = screen.getAllByRole('link');
    expect(chips.map((chip) => chip.getAttribute('href'))).toEqual([
      '/projects/project-a',
      '/projects/project-b',
    ]);
    expect(chips[0]).toHaveTextContent('Newest board');
    expect(chips[0]).toHaveTextContent('80%');
    expect(chips[1]).toHaveTextContent('Older board');
    expect(chips[1]).toHaveTextContent('20%');
  });

  it('renders nothing when there are no recents', () => {
    const { container } = render(<RecentProjects projects={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Recents')).not.toBeInTheDocument();
  });
});
