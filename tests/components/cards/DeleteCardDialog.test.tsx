// tests/components/cards/DeleteCardDialog.test.tsx
//
// Tests for the delete card confirmation dialog.
//
// Tested:
// - Requires confirmation before calling deleteCard
// - Cancel leaves the card in place
//
// What is covered:
// - Confirm-delete interaction
//
// Run with: pnpm test:run tests/components/cards/DeleteCardDialog.test.tsx
//
// SEE: src/components/cards/DeleteCardDialog.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deleteCard = vi.fn();

vi.mock('@/actions/deleteCard', () => ({
  deleteCard,
}));

const { default: DeleteCardDialog } = await import('@/components/cards/DeleteCardDialog');

describe('DeleteCardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteCard.mockResolvedValue({ data: { id: 'card-1' } });
  });

  it('requires confirmation before calling deleteCard', async () => {
    const user = userEvent.setup();
    render(<DeleteCardDialog cardId="card-1" title="Write tests" />);

    await user.click(screen.getByRole('button', { name: 'Delete card Write tests' }));

    expect(deleteCard).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Delete card' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm delete card Write tests' }));

    expect(deleteCard).toHaveBeenCalledWith({ cardId: 'card-1' });
  });

  it('does not delete when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<DeleteCardDialog cardId="card-1" title="Write tests" />);

    await user.click(screen.getByRole('button', { name: 'Delete card Write tests' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(deleteCard).not.toHaveBeenCalled();
  });
});
