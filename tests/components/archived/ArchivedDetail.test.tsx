// tests/components/archived/ArchivedDetail.test.tsx
//
// Tests for markdown on archived card text.
//
// Tested:
// - An archived card title renders inline markdown
// - A comment body renders markdown
// - A project title stays plain text
//
// What is covered:
// - Card title, comment body, project title unchanged
//
// Run with: pnpm test:run tests/components/archived/ArchivedDetail.test.tsx
//
// SEE: src/components/archived/ArchivedDetail.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import ArchivedDetail from '@/components/archived/ArchivedDetail';
import type { ArchivedProject, ArchivedTask } from '@/lib/archived';

const card: ArchivedTask = {
  id: 'card-1',
  title: '**Write tests**',
  code: 'SB-1',
  description: null,
  archivedAt: new Date('2026-08-20T10:00:00.000Z'),
  archivedBy: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
  column: { id: 'col-todo', title: 'To do' },
  label: { id: 'label-design', name: 'Design', tone: 'blue' },
  assignees: [],
  subtasks: [],
  comments: [
    {
      id: 'c1',
      body: 'Looks **good**',
      createdAt: new Date('2026-08-20T10:00:00.000Z'),
      editedAt: null,
      author: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    },
  ],
};

const project: ArchivedProject = {
  id: 'proj-1',
  title: '**Sprint**',
  description: null,
  status: 'NEW',
  statusLabel: 'New',
  taskCount: 0,
  doneCount: 0,
  percent: 0,
  ownerName: 'Ada',
  archivedAt: new Date('2026-08-20T10:00:00.000Z'),
  archivedBy: null,
  members: [],
  columns: [],
  canAdminister: true,
};

describe('ArchivedDetail', () => {
  it('renders markdown in a card title and comment', () => {
    render(
      <ArchivedDetail
        card={card}
        canAdminister
        onClose={vi.fn()}
        onRestore={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Write tests' }).querySelector('strong'),
    ).toHaveTextContent('Write tests');
    expect(screen.getByText('good').tagName).toBe('STRONG');
  });

  it('leaves a project title as plain text', () => {
    render(
      <ArchivedDetail
        project={project}
        canAdminister
        onClose={vi.fn()}
        onRestore={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const heading = screen.getByRole('heading', { name: '**Sprint**' });
    expect(heading.querySelector('strong')).toBeNull();
    expect(heading).toHaveTextContent('**Sprint**');
  });
});
