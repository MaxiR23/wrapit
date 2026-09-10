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
// - Cards do not lock touch-action to pan-y, and the rail is not touch-none
// - The rail listens to touchmove as non-passive and preventDefaults only after a lift
// - Moving past the slop before 420ms does not lift
// - The add-card control uses touch-manipulation and reports the column
// - Each carousel item is a bounded flex column so BoardColumn can shrink
//
// What is covered:
// - Carousel dots, long-press drag drop, cancelled lift, touch-action contract,
//   non-passive touchmove while lifted, add-card click, column-wrapper height
//   chain. jsdom cannot prove a real swipe scrolls the rail or column, or that
//   a phone tap reaches the plus; those need a device.
//
// Run with: pnpm test:run tests/components/projects/BoardMobile.test.tsx
//
// SEE: src/components/projects/BoardMobile.tsx

import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BoardMobile from '@/components/projects/BoardMobile';
import type { BoardCardData, BoardColumnData } from '@/components/projects/boardTypes';
import { carouselScrollLeftForIndex } from '@/lib/board';

type BoardMobileProps = ComponentProps<typeof BoardMobile>;
type MoveToColumn = BoardMobileProps['onMoveToColumn'];
type AddCard = NonNullable<BoardMobileProps['onAddCard']>;
type OpenCard = BoardMobileProps['onOpenCard'];

const cardA: BoardCardData = { id: 'card-a', title: 'Card A', code: 'CA-1', dueDate: null };
const cardC: BoardCardData = { id: 'card-c', title: 'Card C', code: 'CC-3', dueDate: null };

const columns: BoardColumnData[] = [
  { id: 'column-todo', title: 'To do', order: 0, cards: [cardA] },
  { id: 'column-doing', title: 'Doing', order: 1, cards: [cardC] },
];

const cardsById = { 'card-a': cardA, 'card-c': cardC };
const itemsByColumn = { 'column-todo': ['card-a'], 'column-doing': ['card-c'] };

function renderBoard({
  onMoveToColumn = vi.fn<MoveToColumn>(),
  onAddCard = vi.fn<AddCard>(),
}: {
  onMoveToColumn?: MoveToColumn;
  onAddCard?: AddCard;
} = {}) {
  return render(
    <BoardMobile
      columns={columns}
      cardsById={cardsById}
      itemsByColumn={itemsByColumn}
      jumpToColumnId={null}
      onMoveToColumn={onMoveToColumn}
      onAddCard={onAddCard}
      onOpenCard={vi.fn<OpenCard>()}
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

function rail() {
  return screen.getByRole('region', { name: 'Board columns' });
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

  it('sizes each carousel item as a bounded flex column so BoardColumn can shrink', () => {
    renderBoard();

    const column = screen.getByRole('heading', { name: 'To do' }).closest('section');
    const item = column?.parentElement;

    expect(item).toHaveClass('flex', 'h-full', 'min-h-0', 'shrink-0', 'flex-col');
    expect(column).toHaveClass('min-h-0', 'flex-1', 'overflow-hidden');
  });

  it('does not lock cards to vertical pan and leaves the rail scrollable', () => {
    renderBoard();

    expect(cardArticle('Card A')).not.toHaveClass('touch-pan-y');
    expect(cardArticle('Card A').className).not.toMatch(/touch-pan/);
    expect(rail()).toHaveClass('snap-x');
    expect(rail()).not.toHaveClass('touch-none');
  });

  it('listens to rail touchmove as non-passive so a lift can cancel the pan', () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    renderBoard();

    expect(add).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
  });

  it('prevents native touchmove only after a lift', async () => {
    vi.useFakeTimers();
    renderBoard();

    const before = new Event('touchmove', { bubbles: true, cancelable: true });
    rail().dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);

    fireEvent.pointerDown(cardArticle('Card A'), { clientX: 10, clientY: 10, pointerId: 1 });
    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    const after = new Event('touchmove', { bubbles: true, cancelable: true });
    rail().dispatchEvent(after);
    expect(after.defaultPrevented).toBe(true);
  });

  it('does not lift when the pointer moves past the slop before 420ms', async () => {
    vi.useFakeTimers();
    renderBoard();

    fireEvent.pointerDown(cardArticle('Card A'), { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(rail(), { clientX: 20, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(1);
  });

  it('opens add-card from the plus and marks it as a tap target', async () => {
    const user = userEvent.setup();
    const onAddCard = vi.fn<AddCard>();
    renderBoard({ onAddCard });

    const plus = screen.getByRole('button', { name: 'Add card to To do' });
    expect(plus).toHaveClass('touch-manipulation');
    await user.click(plus);

    expect(onAddCard).toHaveBeenCalledWith('column-todo', plus);
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
    const onMoveToColumn = vi.fn<MoveToColumn>();
    renderBoard({ onMoveToColumn });

    const card = cardArticle('Card A');
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(2);
    expect(screen.queryByText('Move CA-1 to')).not.toBeInTheDocument();
    expect(rail()).toHaveClass('snap-none');
    expect(rail()).not.toHaveClass('touch-none');

    vi.mocked(document.elementFromPoint).mockReturnValue(dropNode('Doing'));
    fireEvent.pointerMove(rail(), { clientX: 200, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(rail(), { clientX: 200, clientY: 40, pointerId: 1 });

    expect(onMoveToColumn).toHaveBeenCalledWith('card-a', 'column-doing');
    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(1);
  });

  it('clears the lift when a long press is released without a new column', async () => {
    vi.useFakeTimers();
    const onMoveToColumn = vi.fn<MoveToColumn>();
    renderBoard({ onMoveToColumn });

    const card = cardArticle('Card A');
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(2);

    vi.mocked(document.elementFromPoint).mockReturnValue(dropNode('To do'));
    fireEvent.pointerUp(rail(), { clientX: 10, clientY: 10, pointerId: 1 });

    expect(onMoveToColumn).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(1);
    expect(screen.queryByText('Move CA-1 to')).not.toBeInTheDocument();
  });

  it('drops nothing and clears the lift when a drag is cancelled', async () => {
    vi.useFakeTimers();
    const onMoveToColumn = vi.fn<MoveToColumn>();
    renderBoard({ onMoveToColumn });

    const card = cardArticle('Card A');
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(2);

    vi.mocked(document.elementFromPoint).mockReturnValue(dropNode('Doing'));
    fireEvent.pointerMove(rail(), { clientX: 200, clientY: 40, pointerId: 1 });
    fireEvent.pointerCancel(rail(), { clientX: 200, clientY: 40, pointerId: 1 });

    expect(onMoveToColumn).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(1);
  });

  it('drops nothing when a drag passes over a column and releases outside every column', async () => {
    vi.useFakeTimers();
    const onMoveToColumn = vi.fn<MoveToColumn>();
    renderBoard({ onMoveToColumn });

    const card = cardArticle('Card A');
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 });

    await act(async () => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(2);

    vi.mocked(document.elementFromPoint).mockReturnValue(dropNode('Doing'));
    fireEvent.pointerMove(rail(), { clientX: 200, clientY: 40, pointerId: 1 });
    vi.mocked(document.elementFromPoint).mockReturnValue(null);
    fireEvent.pointerUp(rail(), { clientX: 0, clientY: 0, pointerId: 1 });

    expect(onMoveToColumn).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-card-id="card-a"]')).toHaveLength(1);
  });
});
