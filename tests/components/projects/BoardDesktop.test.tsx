// tests/components/projects/BoardDesktop.test.tsx
//
// Tests for the desktop board Move menu.
//
// Tested:
// - Keyboard Move lists other columns and reports the chosen destination
//
// What is covered:
// - Keyboard column move
//
// Run with: pnpm test:run tests/components/projects/BoardDesktop.test.tsx
//
// SEE: src/components/projects/BoardDesktop.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BoardDesktop from '@/components/projects/BoardDesktop';
import type { BoardCardData, BoardColumnData } from '@/components/projects/boardTypes';

const cardA: BoardCardData = { id: 'card-a', title: 'Card A', code: 'CA-1', dueDate: null };
const cardC: BoardCardData = { id: 'card-c', title: 'Card C', code: 'CC-3', dueDate: null };

const columns: BoardColumnData[] = [
  { id: 'column-todo', title: 'To do', order: 0, cards: [cardA] },
  { id: 'column-doing', title: 'Doing', order: 1, cards: [cardC] },
];

const cardsById = { 'card-a': cardA, 'card-c': cardC };

describe('BoardDesktop', () => {
  it('moves a card through the keyboard Move menu', async () => {
    const user = userEvent.setup();
    const onMoveToColumn = vi.fn();

    render(
      <BoardDesktop
        columns={columns}
        cardsById={cardsById}
        draggingId={null}
        overColumnId={null}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        onDragOverColumn={vi.fn()}
        onDropOnColumn={vi.fn()}
        onMoveToColumn={onMoveToColumn}
        onAddCard={vi.fn()}
        onOpenCard={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Move Card A' }));
    await user.click(screen.getByRole('option', { name: 'Doing' }));

    expect(onMoveToColumn).toHaveBeenCalledWith('card-a', 'column-doing');
  });
});
