// tests/components/cards/EditCardDialog.test.tsx
//
// Tests for the edit card dialog.
//
// Tested:
// - Opens with the current values and submits updates to updateCard
//
// What is covered:
// - Open and submit happy path
//
// Run with: pnpm test:run tests/components/cards/EditCardDialog.test.tsx
//
// SEE: src/components/cards/EditCardDialog.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateCard = vi.fn();

vi.mock('@/actions/updateCard', () => ({
  updateCard,
}));

const { default: EditCardDialog } = await import('@/components/cards/EditCardDialog');

describe('EditCardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCard.mockResolvedValue({
      data: {
        id: 'card-1',
        title: 'Updated title',
        description: 'Updated description',
        order: 1,
        columnId: 'column-1',
      },
    });
  });

  it('opens with the current values and submits updates to updateCard', async () => {
    const user = userEvent.setup();
    render(<EditCardDialog cardId="card-1" title="Old title" description="Old description" />);

    await user.click(screen.getByRole('button', { name: 'Edit card Old title' }));

    expect(await screen.findByRole('heading', { name: 'Edit card' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Old title');
    expect(screen.getByLabelText('Description')).toHaveValue('Old description');

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Updated title');
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Updated description');
    await user.click(screen.getByRole('button', { name: 'Save card' }));

    expect(updateCard).toHaveBeenCalledWith({
      cardId: 'card-1',
      title: 'Updated title',
      description: 'Updated description',
    });
  });
});
