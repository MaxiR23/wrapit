// tests/components/projects/BoardMobile.test.tsx
//
// Tests for the mobile board carousel and long-press move.
//
// Tested:
// - Tappable dots scroll the rail to the chosen column
// - A destination tap after a long press reports the column move
//
// What is covered:
// - Carousel dots, long-press destination strip
//
// Run with: pnpm test:run tests/components/projects/BoardMobile.test.tsx
//
// SEE: src/components/projects/BoardMobile.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import BoardMobile from '@/components/projects/BoardMobile';
import type { BoardCardData, BoardColumnData } from '@/components/projects/boardTypes';
import { carouselScrollLeftForIndex } from '@/lib/board';

const cardA: BoardCardData = { id: 'card-a', title: 'Card A', code: 'CA-1', dueDate: null };
const cardC: BoardCardData = { id: 'card-c', title: 'Card C', code: 'CC-3', dueDate: null };

const columns: BoardColumnData[] = [
  { id: 'column-todo', title: 'To do', order: 0, cards: [cardA] },
  { id: 'column-doing', title: 'Doing', order: 1, cards: [cardC] },
];

const cardsById = { 'card-a': cardA, 'card-c': cardC };
const itemsByColumn = { 'column-todo': ['card-a'], 'column-doing': ['card-c'] };

describe('BoardMobile', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scrolls the rail when a column dot is pressed', () => {
    render(
      <BoardMobile
        columns={columns}
        cardsById={cardsById}
        itemsByColumn={itemsByColumn}
        jumpToColumnId={null}
        onMoveToColumn={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Doing · 1' }));

    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({
      left: carouselScrollLeftForIndex(1),
      behavior: 'smooth',
    });
  });

  it('moves a card when a destination is tapped after a long press', async () => {
    vi.useFakeTimers();
    const onMoveToColumn = vi.fn();

    render(
      <BoardMobile
        columns={columns}
        cardsById={cardsById}
        itemsByColumn={itemsByColumn}
        jumpToColumnId={null}
        onMoveToColumn={onMoveToColumn}
      />,
    );

    const card = screen.getByRole('heading', { name: 'Card A' }).closest('article');
    if (!card) throw new Error('Missing card article');

    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(screen.getByText('Move CA-1 to')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Doing' }));

    expect(onMoveToColumn).toHaveBeenCalledWith('card-a', 'column-doing');
  });
});
