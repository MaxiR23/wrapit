// tests/components/cards/NewCardDialog.test.tsx
//
// Tests for the new card dialog.
//
// Tested:
// - Labels the trigger with the column title
// - Opens the dialog and submits title and description to createCard
//
// What is covered:
// - Accessible label, open and submit happy path
//
// Run with: pnpm test:run tests/components/cards/NewCardDialog.test.tsx
//
// SEE: src/components/cards/NewCardDialog.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createCard = vi.fn();

vi.mock('@/actions/createCard', () => ({
  createCard,
}));

const { default: NewCardDialog } = await import('@/components/cards/NewCardDialog');

describe('NewCardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCard.mockResolvedValue({
      data: {
        id: 'card-1',
        title: 'Write tests',
        description: 'Cover ownership',
        order: 1,
        columnId: 'column-1',
      },
    });
  });

  it('labels the trigger with the column title', () => {
    render(<NewCardDialog columnId="column-1" columnTitle="To do" />);

    expect(screen.getByRole('button', { name: 'New card in To do' })).toBeInTheDocument();
  });

  it('opens the dialog and submits title and description to createCard', async () => {
    const user = userEvent.setup();
    render(<NewCardDialog columnId="column-1" columnTitle="To do" />);

    await user.click(screen.getByRole('button', { name: 'New card in To do' }));

    expect(await screen.findByRole('heading', { name: 'New card' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Write tests');
    await user.type(screen.getByLabelText('Description'), 'Cover ownership');
    await user.click(screen.getByRole('button', { name: 'Create card' }));

    expect(createCard).toHaveBeenCalledWith({
      columnId: 'column-1',
      title: 'Write tests',
      description: 'Cover ownership',
    });
  });
});
