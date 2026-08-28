// tests/components/projects/BoardMobile.test.tsx
//
// Tests for the mobile board carousel and long-press drag.
//
// Tested:
// - Tappable dots scroll the rail to the chosen column
// - A long press then pointer move onto another column reports the move
// - Releasing a long press without a new column clears the lift
// - Cancelling a drag after the lift drops nothing and clears the lift
// - Releasing outside every column after passing over one moves nothing
// - Cards reserve vertical pan so a hold is not a carousel gesture
//
// What is covered:
// - Carousel dots, long-press drag drop, cancelled lift, card touch-action
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

function renderBoard(onMoveToColumn = vi.fn()) {
  return render(
    <BoardMobile
      columns={columns}
      cardsById={cardsById}
      itemsByColumn={itemsByColumn}
      jumpToColumnId={null}
      onMoveToColumn={onMoveToColumn}
      onAddCard={vi.fn()}
      onOpenCard={vi.fn()}
    />,
  );
}

function cardArticle(title: string) {
  const card = screen.getByRole('heading', { name: title }).closest('article');
  if (!card) throw new Error(`Missing card article for ${title}`);
  return card;
}

function dropNode(columnTitle: string) {
  const heading = screen.getByRole('heading', { name: columnTitle });
  const node = heading.closest('[data-drop]');
  if (!node) throw new Error(`Missing data-drop for ${columnTitle}`);
  return node;
}

describe('BoardMobile', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    document.elementFromPoint = vi.fn(() => null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reserves vertical pan on cards and leaves the rail scrollable', () => {
    renderBoard();

    expect(cardArticle('Card A')).toHaveClass('touch-pan-y');
    const rail = screen.getByRole('region', { name: 'Board columns' });
    expect(rail).toHaveClass('snap-x');
    expect(rail).not.toHaveClass('touch-none');
  });

  it('scrolls the rail when a column dot is pressed', () => {
    renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Doing · 1' }));

    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({
      left: carouselScrollLeftForIndex(1),
      behavior: 'smooth',
    });
  });

  it('moves a card when a long press is dragged onto another column', async () => {
    vi.useFakeTimers();
    const onMoveToColumn = vi.fn();
    renderBoard(onMoveToColumn);

    const card = cardArticle('Card A');
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(2);
    expect(screen.queryByText('Move CA-1 to')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Board columns' })).toHaveClass('snap-none');
    expect(screen.getByRole('region', { name: 'Board columns' })).not.toHaveClass('touch-none');

    const rail = screen.getByRole('region', { name: 'Board columns' });
    vi.mocked(document.elementFromPoint).mockReturnValue(dropNode('Doing'));
    fireEvent.pointerMove(rail, { clientX: 200, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(rail, { clientX: 200, clientY: 40, pointerId: 1 });

    expect(onMoveToColumn).toHaveBeenCalledWith('card-a', 'column-doing');
    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(1);
  });

  it('clears the lift when a long press is released without a new column', async () => {
    vi.useFakeTimers();
    const onMoveToColumn = vi.fn();
    renderBoard(onMoveToColumn);

    const card = cardArticle('Card A');
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(2);

    const rail = screen.getByRole('region', { name: 'Board columns' });
    vi.mocked(document.elementFromPoint).mockReturnValue(dropNode('To do'));
    fireEvent.pointerUp(rail, { clientX: 10, clientY: 10, pointerId: 1 });

    expect(onMoveToColumn).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(1);
    expect(screen.queryByText('Move CA-1 to')).not.toBeInTheDocument();
  });

  it('drops nothing and clears the lift when a drag is cancelled', async () => {
    vi.useFakeTimers();
    const onMoveToColumn = vi.fn();
    renderBoard(onMoveToColumn);

    const card = cardArticle('Card A');
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(2);

    const rail = screen.getByRole('region', { name: 'Board columns' });
    vi.mocked(document.elementFromPoint).mockReturnValue(dropNode('Doing'));
    fireEvent.pointerMove(rail, { clientX: 200, clientY: 40, pointerId: 1 });
    fireEvent.pointerCancel(rail, { clientX: 200, clientY: 40, pointerId: 1 });

    expect(onMoveToColumn).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(1);
  });

  it('drops nothing when a drag passes over a column and releases outside every column', async () => {
    vi.useFakeTimers();
    const onMoveToColumn = vi.fn();
    renderBoard(onMoveToColumn);

    const card = cardArticle('Card A');
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(2);

    const rail = screen.getByRole('region', { name: 'Board columns' });
    vi.mocked(document.elementFromPoint).mockReturnValue(dropNode('Doing'));
    fireEvent.pointerMove(rail, { clientX: 200, clientY: 40, pointerId: 1 });
    vi.mocked(document.elementFromPoint).mockReturnValue(null);
    fireEvent.pointerUp(rail, { clientX: 0, clientY: 0, pointerId: 1 });

    expect(onMoveToColumn).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(1);
  });
});
