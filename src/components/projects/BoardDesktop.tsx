import { useEffect, useRef, useState } from 'react';

import BoardCard from '@/components/cards/BoardCard';
import BoardColumn from '@/components/projects/BoardColumn';
import type { BoardCardData, BoardColumnData } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { DEFAULT_BOARD_VISIBILITY, type BoardVisibility } from '@/lib/boardView';
import { cn } from '@/lib/utils';

export default function BoardDesktop({
  columns,
  cardsById,
  draggingId,
  overColumnId,
  visibility = DEFAULT_BOARD_VISIBILITY,
  canEdit = true,
  onDragStart,
  onDragEnd,
  onDragOverColumn,
  onDropOnColumn,
  onMoveToColumn,
  onAddCard,
  onOpenCard,
}: {
  columns: BoardColumnData[];
  cardsById: Record<string, BoardCardData>;
  draggingId: string | null;
  overColumnId: string | null;
  visibility?: BoardVisibility;
  canEdit?: boolean;
  onDragStart: (cardId: string) => void;
  onDragEnd: () => void;
  onDragOverColumn: (columnId: string | null) => void;
  onDropOnColumn: (columnId: string) => void;
  onMoveToColumn: (cardId: string, columnId: string) => void;
  onAddCard?: (columnId: string, trigger: HTMLButtonElement) => void;
  onOpenCard: (cardId: string, trigger: HTMLElement) => void;
}) {
  return (
    <div
      data-board="desktop"
      className="hidden min-h-0 flex-1 gap-3 overflow-x-auto px-[18px] pb-[18px] tablet:flex lg:gap-3.5 lg:px-7 lg:pb-7"
    >
      {columns.map((column) => (
        <BoardColumn
          key={column.id}
          columnId={column.id}
          title={column.title}
          cards={column.cards}
          className="w-[300px] flex-none lg:w-auto lg:flex-1 lg:min-w-0"
          highlighted={overColumnId === column.id}
          dimmedCardId={draggingId}
          onDragOver={
            canEdit
              ? (event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  onDragOverColumn(column.id);
                }
              : undefined
          }
          onDrop={
            canEdit
              ? (event) => {
                  event.preventDefault();
                  onDropOnColumn(column.id);
                }
              : undefined
          }
          onAddCard={onAddCard}
          renderCard={(card) => (
            <DesktopCard
              card={cardsById[card.id] ?? card}
              columns={columns}
              visibility={visibility}
              dimmed={draggingId === card.id}
              canMove={canEdit}
              onDragStart={() => onDragStart(card.id)}
              onDragEnd={onDragEnd}
              onMoveToColumn={onMoveToColumn}
              onOpenCard={onOpenCard}
            />
          )}
        />
      ))}
    </div>
  );
}

function DesktopCard({
  card,
  columns,
  visibility,
  dimmed,
  canMove = true,
  onDragStart,
  onDragEnd,
  onMoveToColumn,
  onOpenCard,
}: {
  card: BoardCardData;
  columns: BoardColumnData[];
  visibility: BoardVisibility;
  dimmed: boolean;
  canMove?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMoveToColumn: (cardId: string, columnId: string) => void;
  onOpenCard: (cardId: string, trigger: HTMLElement) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const draggedRef = useRef(false);
  const destinations = columns.filter(
    (column) => !column.cards.some((item) => item.id === card.id),
  );

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <BoardCard
      card={card}
      visibility={visibility}
      dimmed={dimmed}
      draggable={canMove}
      onDragStart={
        canMove
          ? (event) => {
              draggedRef.current = true;
              event.dataTransfer.setData('text/plain', card.id);
              event.dataTransfer.effectAllowed = 'move';
              onDragStart();
            }
          : undefined
      }
      onDragEnd={
        canMove
          ? () => {
              onDragEnd();
              requestAnimationFrame(() => {
                draggedRef.current = false;
              });
            }
          : undefined
      }
      onClick={(event) => {
        if (draggedRef.current) return;
        onOpenCard(card.id, event.currentTarget);
      }}
      moveMenu={
        canMove && destinations.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-label={`Move ${card.title}`}
              onClick={() => setMenuOpen((open) => !open)}
              className={cn(
                shellFocusClassName,
                'rounded-sm bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground',
                'sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-0 focus-visible:right-0',
              )}
            >
              Move
            </button>
            {menuOpen ? (
              <ul
                role="listbox"
                aria-label={`Move ${card.title} to`}
                className="absolute top-full right-0 z-20 mt-1 min-w-[140px] rounded-[10px] border border-border-strong bg-surface p-1 shadow-[0_16px_40px_oklch(0_0_0/0.55)]"
              >
                {destinations.map((column) => (
                  <li key={column.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        setMenuOpen(false);
                        onMoveToColumn(card.id, column.id);
                      }}
                      className={cn(
                        shellFocusClassName,
                        'flex w-full rounded-sm px-2.5 py-1.5 text-left text-[13px] hover:bg-card',
                      )}
                    >
                      {column.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
