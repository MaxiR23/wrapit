// tests/components/cards/BoardCard.test.tsx
//
// Tests for the shared board card face.
//
// Tested:
// - Renders title and stored code
// - Shows 0 comments and 0/0 subtasks when lists are empty
// - Shows a due label and the late token when the date is before today
// - Renders a label pill for a known tone
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
});
