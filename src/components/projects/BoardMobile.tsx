import type { PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import BoardCard from '@/components/cards/BoardCard';
import BoardColumn from '@/components/projects/BoardColumn';
import MobileMoveStrip from '@/components/projects/MobileMoveStrip';
import type { BoardCardData, BoardColumnData } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { DEFAULT_BOARD_VISIBILITY, type BoardVisibility } from '@/lib/boardView';
import {
  BOARD_COLUMN_WIDTH_PX,
  BOARD_LONG_PRESS_MOVE_PX,
  BOARD_LONG_PRESS_MS,
  carouselIndexFromScroll,
  carouselScrollLeftForIndex,
} from '@/lib/board';
import { findContainer } from '@/lib/kanbanItems';
import { cn } from '@/lib/utils';

export default function BoardMobile({
  columns,
  cardsById,
  itemsByColumn,
  jumpToColumnId,
  jumpToken = 0,
  visibility = DEFAULT_BOARD_VISIBILITY,
  onMoveToColumn,
  onAddCard,
  onOpenCard,
}: {
  columns: BoardColumnData[];
  cardsById: Record<string, BoardCardData>;
  itemsByColumn: Record<string, string[]>;
  jumpToColumnId: string | null;
  jumpToken?: number;
  visibility?: BoardVisibility;
  onMoveToColumn: (cardId: string, columnId: string) => void;
  onAddCard: (columnId: string, trigger: HTMLButtonElement) => void;
  onOpenCard: (cardId: string, trigger: HTMLElement) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);
  const draggedRef = useRef(false);
  const liftedIdRef = useRef<string | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!jumpToColumnId) return;
    const index = columns.findIndex((column) => column.id === jumpToColumnId);
    if (index < 0) return;
    railRef.current?.scrollTo?.({ left: carouselScrollLeftForIndex(index), behavior: 'smooth' });
  }, [jumpToColumnId, jumpToken, columns]);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function clearLift() {
    liftedIdRef.current = null;
    setLiftedId(null);
    setOverColumnId(null);
    draggedRef.current = false;
  }

  function dropTargetFromPoint(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    const node = el instanceof Element ? el.closest('[data-drop]') : null;
    return node?.getAttribute('data-drop') ?? null;
  }

  function revealColumn(columnId: string) {
    const index = columns.findIndex((column) => column.id === columnId);
    if (index < 0) return;
    railRef.current?.scrollTo?.({ left: carouselScrollLeftForIndex(index), behavior: 'smooth' });
    setVisibleIndex(index);
  }

  function startPress(cardId: string, event: PointerEvent<HTMLElement>) {
    clearTimer();
    didLongPressRef.current = false;
    draggedRef.current = false;
    pointerIdRef.current = event.pointerId;
    startRef.current = { x: event.clientX, y: event.clientY };
    const pointerId = event.pointerId;
    timerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      liftedIdRef.current = cardId;
      setLiftedId(cardId);
      setOverColumnId(null);
      railRef.current?.setPointerCapture(pointerId);
    }, BOARD_LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (liftedIdRef.current) {
      event.preventDefault();
      const start = startRef.current;
      if (start) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) > BOARD_LONG_PRESS_MOVE_PX) {
          draggedRef.current = true;
        }
      }
      const key = dropTargetFromPoint(event.clientX, event.clientY);
      if (key !== overColumnId) setOverColumnId(key);
      return;
    }
    const start = startRef.current;
    if (!start || timerRef.current == null) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > BOARD_LONG_PRESS_MOVE_PX) {
      clearTimer();
    }
  }

  function releaseCapture(event: PointerEvent<HTMLElement>) {
    const pointerId = pointerIdRef.current ?? event.pointerId;
    pointerIdRef.current = null;
    if (railRef.current?.hasPointerCapture(pointerId)) {
      railRef.current.releasePointerCapture(pointerId);
    }
  }

  function finishPress(event: PointerEvent<HTMLElement>) {
    clearTimer();
    const id = liftedIdRef.current;
    if (!id) {
      startRef.current = null;
      releaseCapture(event);
      return;
    }
    const key = dropTargetFromPoint(event.clientX, event.clientY) ?? overColumnId;
    const source = findContainer(itemsByColumn, id);
    releaseCapture(event);
    startRef.current = null;
    if (draggedRef.current && key && key !== source) {
      onMoveToColumn(id, key);
      revealColumn(key);
      clearLift();
    }
  }

  function cancelPress() {
    clearTimer();
    startRef.current = null;
    pointerIdRef.current = null;
    clearLift();
  }

  const liftedCard = liftedId ? cardsById[liftedId] : null;
  const liftedColumnId = liftedId ? (findContainer(itemsByColumn, liftedId) ?? '') : '';
  const liveTitle = columns[visibleIndex]?.title ?? '';
  const liveCount = columns.length;

  return (
    <div data-board="mobile" className="flex min-h-0 flex-1 flex-col tablet:hidden">
      <div className="flex shrink-0 items-center justify-center gap-1.5 pb-2.5">
        {columns.map((column, index) => {
          const active = visibleIndex === index;
          return (
            <button
              key={column.id}
              type="button"
              title={`${column.title} · ${column.cards.length}`}
              aria-label={`${column.title} · ${column.cards.length}`}
              aria-current={active ? 'true' : undefined}
              onClick={() => {
                railRef.current?.scrollTo?.({
                  left: carouselScrollLeftForIndex(index),
                  behavior: 'smooth',
                });
                setVisibleIndex(index);
              }}
              className={cn(
                shellFocusClassName,
                'h-1.5 rounded-full p-0',
                active ? 'w-5 bg-foreground' : 'w-1.5 bg-muted',
              )}
            />
          );
        })}
      </div>

      <div
        ref={railRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Board columns"
        onScroll={(event) => {
          if (!liftedIdRef.current) clearTimer();
          const next = carouselIndexFromScroll(event.currentTarget.scrollLeft, columns.length);
          if (next !== visibleIndex) setVisibleIndex(next);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={finishPress}
        onPointerCancel={cancelPress}
        className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-4 pb-3.5 snap-x snap-mandatory"
      >
        {columns.map((column) => (
          <div
            key={column.id}
            data-drop={column.id}
            className="shrink-0 snap-center"
            style={{ width: BOARD_COLUMN_WIDTH_PX }}
          >
            <BoardColumn
              columnId={column.id}
              title={column.title}
              cards={column.cards}
              highlighted={overColumnId === column.id}
              liftedCardId={liftedId}
              onAddCard={onAddCard}
              renderCard={(card) => (
                <BoardCard
                  card={cardsById[card.id] ?? card}
                  visibility={visibility}
                  lifted={liftedId === card.id}
                  onPointerDown={(event) => startPress(card.id, event)}
                  onPointerCancel={cancelPress}
                  onClick={(event) => {
                    if (didLongPressRef.current || liftedIdRef.current) {
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }
                    onOpenCard(card.id, event.currentTarget);
                  }}
                />
              )}
            />
          </div>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {liveTitle ? `Showing ${liveTitle}, ${visibleIndex + 1} of ${liveCount}` : ''}
      </p>

      {liftedCard ? (
        <MobileMoveStrip
          code={liftedCard.code}
          columns={columns.map((column) => ({ id: column.id, title: column.title }))}
          currentColumnId={liftedColumnId}
          overColumnId={overColumnId}
          onPick={(columnId) => {
            onMoveToColumn(liftedCard.id, columnId);
            revealColumn(columnId);
            clearLift();
          }}
        />
      ) : null}
    </div>
  );
}
