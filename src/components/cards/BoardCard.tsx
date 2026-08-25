import type { DragEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';

import { commentCount, subtaskProgress } from '@/lib/cardCounters';
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
  const comments = card.comments ?? [];
  const subtasks = card.subtasks ?? [];
  const { done: subtaskDone, total: subtaskTotal } = subtaskProgress(subtasks);
  const showDue = card.dueDate != null;
  const assignees = card.assignees ?? [];
  const showPeople = assignees.length > 0;
  const shownPeople = assignees.slice(0, 3);
  const extraCount = assignees.length - shownPeople.length;
  const late = card.dueDate != null && isCardDueLate(card.dueDate);
  const dueLabel = card.dueDate != null ? formatCardDue(card.dueDate) : null;
  const tone = card.label ? labelToneClasses(card.label.tone) : null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' || !onClick) return;
    event.preventDefault();
    onClick(event as unknown as MouseEvent<HTMLElement>);
  }

  return (
    <article
      data-card-id={card.id}
      tabIndex={onClick ? 0 : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative flex flex-col gap-[11px] rounded-[12px] border bg-card p-[13px] shadow-[0_1px_2px_oklch(0_0_0/0.35)]',
        'transition-[transform,box-shadow,opacity,border-color,background] duration-[160ms] ease-out',
        highlighted || lifted
          ? 'border-foreground'
          : 'border-border hover:border-border-strong hover:bg-card-hover',
        lifted && 'scale-[1.03] opacity-90 shadow-[0_16px_34px_oklch(0_0_0/0.6)]',
        dimmed && 'opacity-[0.45]',
        draggable && 'cursor-grab',
        onClick && shellFocusClassName,
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

      <h3 className="text-[13.5px] font-medium leading-[1.35] text-pretty">{card.title}</h3>

      <div className="flex items-center gap-3 border-t border-border pt-[11px] text-[11.5px] text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-[5px]">
          <MessageSquare className="size-[13px]" strokeWidth={2} />
          {commentCount(comments)}
        </span>
        <span>
          {subtaskDone}/{subtaskTotal}
        </span>
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
