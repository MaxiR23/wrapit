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
  className,
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
  className?: string;
}) {
  return (
    <section
      data-drop={columnId}
      data-column-id={columnId}
      onDrop={onDrop}
      onDragOver={onDragOver}
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-[14px] border p-3',
        'transition-[border-color,background] duration-[160ms] ease',
        highlighted ? 'border-border-strong bg-card' : 'border-border bg-surface',
        className,
      )}
    >
      <header className="flex items-center gap-[9px] border-b border-border px-1 pt-0.5 pb-2">
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
            'ml-auto inline-flex size-[30px] items-center justify-center rounded-md text-[16px] leading-none text-muted-foreground lg:size-6 lg:text-[15px]',
            'disabled:opacity-50',
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
      </div>
    </section>
  );
}
