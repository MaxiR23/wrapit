import type { DragEvent, ReactNode } from 'react';

import BoardCard from '@/components/cards/BoardCard';
import type { BoardCardData } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

export default function BoardColumn({
  columnId,
  title,
  cards,
  highlighted = false,
  liftedCardId = null,
  dimmedCardId = null,
  onDrop,
  onDragOver,
  renderCard,
}: {
  columnId: string;
  title: string;
  cards: BoardCardData[];
  highlighted?: boolean;
  liftedCardId?: string | null;
  dimmedCardId?: string | null;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  renderCard?: (card: BoardCardData) => ReactNode;
}) {
  return (
    <section
      data-drop={columnId}
      data-column-id={columnId}
      onDrop={onDrop}
      onDragOver={onDragOver}
      className={cn(
        'flex min-h-0 min-w-[280px] flex-1 flex-col gap-2.5 overflow-hidden rounded-[18px] border p-3',
        highlighted ? 'border-foreground bg-card' : 'border-border bg-surface',
      )}
    >
      <header className="flex items-center gap-[9px] border-b border-border px-1 pt-0.5 pb-[9px]">
        <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {title}
        </h2>
        <span className="text-xs font-medium text-subtle tabular-nums">{cards.length}</span>
        <button
          type="button"
          disabled
          aria-label={`Add card to ${title}`}
          className={cn(
            shellFocusClassName,
            'ml-auto inline-flex size-8 items-center justify-center rounded-md text-[19px] leading-none text-muted-foreground disabled:opacity-100',
          )}
        >
          +
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[9px] overflow-y-auto pb-0.5">
        {cards.map((card) =>
          renderCard ? (
            <div key={card.id}>{renderCard(card)}</div>
          ) : (
            <BoardCard
              key={card.id}
              card={card}
              lifted={liftedCardId === card.id}
              dimmed={dimmedCardId === card.id}
            />
          ),
        )}
        {cards.length === 0 ? (
          <div className="flex items-center justify-center rounded-[14px] border border-dashed border-border px-2.5 py-6 text-center text-[12.5px] text-subtle">
            Nothing here yet
          </div>
        ) : null}
      </div>
    </section>
  );
}
