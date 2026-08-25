// tests/components/cards/CardSubtaskList.test.tsx
//
// Tests for coalesced subtask writes on the card detail list.
//
// Tested:
// - A failed toggle reverts only that subtask, leaving a later successful
//   toggle intact
//
// What is covered:
// - Per-subtask revert scope when overlapping done writes finish out of order
//
// Run with: pnpm test:run tests/components/cards/CardSubtaskList.test.tsx
//
// SEE: src/components/cards/CardSubtaskList.tsx

import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BoardSubtask } from '@/components/projects/boardTypes';

vi.mock('@/actions/createSubtask', () => ({ createSubtask: vi.fn() }));
vi.mock('@/actions/deleteSubtask', () => ({ deleteSubtask: vi.fn() }));
vi.mock('@/actions/updateSubtaskField', () => ({
  updateSubtaskField: vi.fn(),
}));

const { default: CardSubtaskList } = await import('@/components/cards/CardSubtaskList');
const { updateSubtaskField } = await import('@/actions/updateSubtaskField');

const initial: BoardSubtask[] = [
  { id: 'sub-1', text: 'Write tests', done: false, order: 1 },
  { id: 'sub-2', text: 'Ship it', done: false, order: 2 },
];

function Harness() {
  const [subtasks, setSubtasks] = useState(initial);
  return <CardSubtaskList cardId="card-1" subtasks={subtasks} onChange={setSubtasks} />;
}

describe('CardSubtaskList', () => {
  it('leaves a later successful toggle intact when an earlier toggle fails', async () => {
    const user = userEvent.setup();
    let failFirst: (value: { error: string }) => void = () => {};
    vi.mocked(updateSubtaskField)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            failFirst = resolve;
          }),
      )
      .mockImplementation(async (input: { value: string | boolean }) => ({
        data: { value: input.value },
      }));

    render(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: 'Write tests' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ship it' }));

    expect(screen.getByRole('checkbox', { name: 'Write tests' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ship it' })).toBeChecked();

    failFirst({ error: 'Something went wrong. Please try again.' });

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Write tests' })).not.toBeChecked();
    });
    expect(screen.getByRole('checkbox', { name: 'Ship it' })).toBeChecked();
  });
});
