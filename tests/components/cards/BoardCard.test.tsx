// tests/components/cards/BoardCard.test.tsx
//
// Tests for the shared board card face.
//
// Tested:
// - Renders title and stored code
// - Shows 0 comments and 0/0 subtasks when lists are empty
// - Shows a due label and the late token when the date is before today
// - Omits the pill when the card has no label
// - Hides label and code together, which removes the top row
// - Hides footer fields when those visibility flags are off
//
// What is covered:
// - Present fields only, overdue styling, unknown tone omitted
//
// Run with: pnpm test:run tests/components/cards/BoardCard.test.tsx
//
// SEE: src/components/cards/BoardCard.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import BoardCard from '@/components/cards/BoardCard';
import type { BoardCardData } from '@/components/projects/boardTypes';

const base: BoardCardData = {
  id: 'card-1',
  title: 'Write the board',
  code: 'WB-1',
  dueDate: null,
};

describe('BoardCard', () => {
  it('renders the title and stored code', () => {
    render(<BoardCard card={base} />);

    expect(screen.getByRole('heading', { name: 'Write the board' })).toBeInTheDocument();
    expect(screen.getByText('WB-1')).toBeInTheDocument();
  });

  it('shows zero comment and subtask counts when lists are empty', () => {
    render(<BoardCard card={base} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });

  it('marks an overdue due date with the late token', () => {
    const now = new Date();
    const due = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1));

    render(<BoardCard card={{ ...base, dueDate: due }} />);

    const dueLabel = screen.getByText('Yesterday').closest('span');
    expect(dueLabel).toHaveClass('text-late');
  });

  it('renders a known label tone', () => {
    render(
      <BoardCard card={{ ...base, label: { id: 'label-1', name: 'Design', tone: 'violet' } }} />,
    );

    expect(screen.getByText('Design')).toHaveClass('text-label-violet');
  });

  it('renders assignee initials from name and username', () => {
    render(
      <BoardCard
        card={{
          ...base,
          assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
        }}
      />,
    );

    expect(screen.getByTitle('Ada Lovelace')).toHaveTextContent('AL');
  });

  it('omits the pill when the card has no label', () => {
    render(<BoardCard card={base} />);

    expect(screen.queryByText('Design')).not.toBeInTheDocument();
  });

  it('hides the label and code when those visibility flags are off', () => {
    render(
      <BoardCard
        card={{ ...base, label: { id: 'label-1', name: 'Design', tone: 'violet' } }}
        visibility={{
          label: false,
          code: false,
          comments: true,
          subtasks: true,
          dueDate: true,
          assignees: true,
        }}
      />,
    );

    expect(screen.queryByText('Design')).not.toBeInTheDocument();
    expect(screen.queryByText('WB-1')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Write the board' })).toBeInTheDocument();
  });

  it('hides comments, subtasks, due date, and assignees when those flags are off', () => {
    const now = new Date();
    const due = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    render(
      <BoardCard
        card={{
          ...base,
          dueDate: due,
          assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
        }}
        visibility={{
          label: true,
          code: true,
          comments: false,
          subtasks: false,
          dueDate: false,
          assignees: false,
        }}
      />,
    );

    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Ada Lovelace')).not.toBeInTheDocument();
  });
});
