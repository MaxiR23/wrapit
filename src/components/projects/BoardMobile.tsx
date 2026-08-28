import type { PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import BoardCard from '@/components/cards/BoardCard';
import BoardColumn from '@/components/projects/BoardColumn';
import type { BoardCardData, BoardColumnData } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { DEFAULT_BOARD_VISIBILITY, type BoardVisibility } from '@/lib/boardView';
import {
  BOARD_COLUMN_WIDTH_PX,
  BOARD_DRAG_EDGE_PX_PER_MS,
  BOARD_LONG_PRESS_MOVE_PX,
  BOARD_LONG_PRESS_MS,
  carouselIndexFromScroll,
  carouselScrollLeftForIndex,
  dragEdgeScrollDirection,
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
  canEdit = true,
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
  canEdit?: boolean;
  onMoveToColumn: (cardId: string, columnId: string) => void;
  onAddCard?: (columnId: string, trigger: HTMLButtonElement) => void;
  onOpenCard: (cardId: string, trigger: HTMLElement) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const edgeDirRef = useRef<-1 | 0 | 1>(0);
  const overColumnIdRef = useRef<string | null>(null);
  const didLongPressRef = useRef(false);
  const liftedIdRef = useRef<string | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
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

  function stopEdgeScroll() {
    edgeDirRef.current = 0;
    lastTsRef.current = null;
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function setOver(key: string | null) {
    if (key === overColumnIdRef.current) return;
    overColumnIdRef.current = key;
    setOverColumnId(key);
  }

  function clearLift() {
    liftedIdRef.current = null;
    lastPointerRef.current = null;
    setLiftedId(null);
    setOver(null);
    setPointer(null);
    stopEdgeScroll();
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

  function edgeScrollLoop(ts: number) {
    const dir = edgeDirRef.current;
    const rail = railRef.current;
    if (!dir || !rail) {
      lastTsRef.current = null;
      rafRef.current = null;
      return;
    }
    const last = lastTsRef.current ?? ts;
    lastTsRef.current = ts;
    const dt = Math.min(ts - last, 32);
    rail.scrollLeft += dir * BOARD_DRAG_EDGE_PX_PER_MS * dt;
    const pointerNow = lastPointerRef.current;
    if (pointerNow) {
      setOver(dropTargetFromPoint(pointerNow.x, pointerNow.y));
    }
    rafRef.current = window.requestAnimationFrame(edgeScrollLoop);
  }

  function updateEdgeDir(clientX: number) {
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const dir = dragEdgeScrollDirection(clientX, rect.left, rect.right);
    edgeDirRef.current = dir;
    if (dir && rafRef.current == null) {
      rafRef.current = window.requestAnimationFrame(edgeScrollLoop);
    }
  }

  function startPress(cardId: string, event: PointerEvent<HTMLElement>) {
    if (!canEdit) return;
    clearTimer();
    didLongPressRef.current = false;
    pointerIdRef.current = event.pointerId;
    startRef.current = { x: event.clientX, y: event.clientY };
    const pointerId = event.pointerId;
    const origin = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      liftedIdRef.current = cardId;
      lastPointerRef.current = origin;
      setLiftedId(cardId);
      setOver(null);
      setPointer(origin);
      railRef.current?.setPointerCapture(pointerId);
    }, BOARD_LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (liftedIdRef.current) {
      event.preventDefault();
      const next = { x: event.clientX, y: event.clientY };
      lastPointerRef.current = next;
      setPointer(next);
      setOver(dropTargetFromPoint(event.clientX, event.clientY));
      updateEdgeDir(event.clientX);
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
    const key = dropTargetFromPoint(event.clientX, event.clientY);
    const source = findContainer(itemsByColumn, id);
    releaseCapture(event);
    startRef.current = null;
    if (key && key !== source) {
      onMoveToColumn(id, key);
      revealColumn(key);
    }
    clearLift();
  }

  function cancelPress(event: PointerEvent<HTMLElement>) {
    clearTimer();
    startRef.current = null;
    releaseCapture(event);
    clearLift();
  }

  const liftedCard = liftedId ? cardsById[liftedId] : null;
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
        className={cn(
          'flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-4 pb-3.5',
          liftedId ? 'snap-none' : 'snap-x snap-mandatory',
        )}
      >
        {columns.map((column) => (
          <div
            key={column.id}
            data-drop={column.id}
            className={cn('shrink-0', !liftedId && 'snap-center')}
            style={{ width: BOARD_COLUMN_WIDTH_PX }}
          >
            <BoardColumn
              columnId={column.id}
              title={column.title}
              cards={column.cards}
              highlighted={overColumnId === column.id}
              dimmedCardId={liftedId}
              onAddCard={onAddCard}
              renderCard={(card) => (
                <BoardCard
                  card={cardsById[card.id] ?? card}
                  visibility={visibility}
                  dimmed={liftedId === card.id}
                  className="touch-pan-y"
                  onPointerDown={canEdit ? (event) => startPress(card.id, event) : undefined}
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

      {liftedCard && pointer ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 w-[min(280px,calc(100vw-2rem))]"
          style={{
            left: pointer.x,
            top: pointer.y,
            transform: 'translate(-50%, -24px)',
          }}
        >
          <BoardCard card={liftedCard} visibility={visibility} lifted />
        </div>
      ) : null}
    </div>
  );
}
