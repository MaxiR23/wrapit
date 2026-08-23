import type { DragEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';

import { formatCardDue, isCardDueLate } from '@/lib/cardDue';
import { initials } from '@/lib/initials';
import { labelToneClasses } from '@/lib/labelTones';
import { cn } from '@/lib/utils';
import type { BoardCardData } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';

export default function BoardCard({
  card,
  lifted = false,
  dimmed = false,
  highlighted = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
  moveMenu,
}: {
  card: BoardCardData;
  lifted?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  moveMenu?: ReactNode;
}) {
  const showLabel = Boolean(card.label);
  const showCode = Boolean(card.code);
  const showTop = showLabel || showCode;
  const showComments = typeof card.commentCount === 'number';
  const showSubtasks =
    typeof card.subtaskDone === 'number' && typeof card.subtaskTotal === 'number';
  const showDue = card.dueDate != null;
  const assignees = card.assignees ?? [];
  const showPeople = assignees.length > 0;
  const shownPeople = assignees.slice(0, 3);
  const extraCount = assignees.length - shownPeople.length;
  const showFooter = showComments || showSubtasks || showDue || showPeople;
  const late = card.dueDate != null && isCardDueLate(card.dueDate);
  const dueLabel = card.dueDate != null ? formatCardDue(card.dueDate) : null;
  const tone = card.label ? labelToneClasses(card.label.tone) : null;

  return (
    <article
      data-card-id={card.id}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      className={cn(
        'relative flex flex-col gap-[11px] rounded-[14px] border bg-card p-3.5 shadow-[0_1px_2px_oklch(0_0_0/0.35)]',
        'transition-[transform,box-shadow,opacity,border-color] duration-[140ms] ease-out',
        highlighted || lifted ? 'border-foreground' : 'border-border',
        lifted && 'scale-[1.03] opacity-90 shadow-[0_16px_34px_oklch(0_0_0/0.6)]',
        dimmed && 'opacity-50',
        draggable && 'cursor-grab',
      )}
    >
      {showTop ? (
        <div className="flex items-center gap-2">
          {showLabel && tone && card.label ? (
            <span
              className={cn(
                'rounded-full border px-2.5 py-[3px] text-[11.5px] font-medium',
                tone.pill,
              )}
            >
              {card.label.name}
            </span>
          ) : null}
          {showCode ? (
            <span className="ml-auto text-[11px] text-subtle tabular-nums">{card.code}</span>
          ) : null}
        </div>
      ) : null}

      <h3 className="text-[14.5px] font-medium leading-[1.35] text-pretty">{card.title}</h3>

      {showFooter ? (
        <div className="flex items-center gap-3 border-t border-border pt-[11px] text-[11.5px] text-muted-foreground tabular-nums">
          {showComments ? (
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="size-[13px]" strokeWidth={2} />
              {card.commentCount}
            </span>
          ) : null}
          {showSubtasks ? (
            <span>
              {card.subtaskDone}/{card.subtaskTotal}
            </span>
          ) : null}
          {showDue ? (
            <span className={cn('ml-auto', late ? 'text-late' : 'text-muted-foreground')}>
              {dueLabel}
            </span>
          ) : null}
          {showPeople ? (
            <div className={cn('flex gap-1', showDue ? '' : 'ml-auto')}>
              {shownPeople.map((member) => (
                <span
                  key={member.id}
                  title={member.name}
                  className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-[9.5px] font-semibold leading-none"
                >
                  {initials(member.name, member.username)}
                </span>
              ))}
              {extraCount > 0 ? (
                <span className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-background text-[9.5px] font-semibold leading-none text-muted-foreground">
                  +{extraCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {moveMenu ? (
        <div
          className={cn(shellFocusClassName, 'absolute top-2 right-2')}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {moveMenu}
        </div>
      ) : null}
    </article>
  );
}
