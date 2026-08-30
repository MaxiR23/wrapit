// tests/components/tasks/MyTaskRow.test.tsx
//
// Tests for opening a task vs following a title link.
//
// Tested:
// - A title link is not nested in a button
// - Activating the row opens the task
// - Clicking the title link does not open the task
//
// What is covered:
// - Valid nesting, row activate, link click isolation
//
// Run with: pnpm test:run tests/components/tasks/MyTaskRow.test.tsx
//
// SEE: src/components/tasks/MyTaskRow.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MyTaskRow from '@/components/tasks/MyTaskRow';
import type { MyTask } from '@/lib/myTasks';

const task: MyTask = {
  id: 'task-today',
  title: '[docs](https://example.com/x)',
  dueDate: new Date(Date.UTC(2026, 7, 26)),
  dueTimeZone: null,
  label: { id: 'label-bug', name: 'Bug', tone: 'red' },
  subtasks: [],
  assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
  project: { id: 'proj-sprint', title: 'Sprint board', access: 'EDIT' },
  columnId: 'col-todo',
  completed: false,
};

describe('MyTaskRow', () => {
  it('renders a title link outside a button, opens from the row, and does not open when the link is clicked', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<MyTaskRow task={task} onOpen={onOpen} onToggleComplete={vi.fn()} />);

    const link = screen.getByRole('link', { name: 'docs' });
    expect(link.closest('button')).toBeNull();
    expect(link).toHaveAttribute('href', 'https://example.com/x');
    expect(link.closest('article')).not.toBeNull();

    await user.click(link);
    expect(onOpen).not.toHaveBeenCalled();

    await user.click(screen.getAllByText('Sprint board')[0]);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
