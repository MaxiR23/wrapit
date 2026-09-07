// tests/components/tasks/MyTasksDetail.test.tsx
//
// Tests for the My tasks detail sheet pin.
//
// Tested:
// - The phone sheet composes safe-inset-x and safe-inset-b
//
// What is covered:
// - Sheet pin classes
//
// Run with: pnpm test:run tests/components/tasks/MyTasksDetail.test.tsx
//
// SEE: src/components/tasks/MyTasksDetail.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import MyTasksDetail from '@/components/tasks/MyTasksDetail';
import type { MyTask } from '@/lib/myTasks';

const task: MyTask = {
  id: 'task-today',
  title: 'Ship the grid',
  dueDate: new Date('2026-08-26T00:00:00.000Z'),
  dueTimeZone: null,
  label: { id: 'label-bug', name: 'Bug', tone: 'red' },
  subtasks: [],
  assignees: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
  project: { id: 'proj-sprint', title: 'Sprint board', access: 'EDIT' },
  columnId: 'col-todo',
  completed: false,
};

describe('MyTasksDetail', () => {
  it('composes safe-inset-x and safe-inset-b on the phone sheet', () => {
    render(<MyTasksDetail task={task} onClose={vi.fn()} onToggleComplete={vi.fn()} />);

    const sheet = screen.getByRole('dialog', { name: 'Task detail' });
    expect(sheet).toHaveClass('fixed', 'safe-inset-x', 'safe-inset-b');
    expect(sheet.className).not.toMatch(/safe-area-inset/);
  });
});
