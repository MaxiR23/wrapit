'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Download, RotateCcw, Trash2 } from 'lucide-react';

import { shellFocusClassName } from '@/components/projects/shell';
import {
  ARCHIVED_LONG_PRESS_MOVE_PX,
  ARCHIVED_LONG_PRESS_MS,
  ARCHIVED_SWIPE_COMMIT_PX,
  ARCHIVED_SWIPE_LIMIT_PX,
  ARCHIVED_SWIPE_OPEN_PX,
  ARCHIVED_SWIPE_REST_PX,
  ARCHIVED_SWIPE_REVEAL_PX,
  ARCHIVED_SWIPE_TAP_PX,
  archivedByLine,
  archivedTaskDetailLine,
  formatArchivedDate,
  type ArchivedTask,
} from '@/lib/archived';
import { archivedCopy } from '@/lib/archivedCopy';
import { subtaskProgress } from '@/lib/cardCounters';
import { initials } from '@/lib/initials';
import { labelToneClasses } from '@/lib/labelTones';
import { cn } from '@/lib/utils';

function ArchivedCheckbox({
  checked,
  label,
  onToggle,
  className,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onChange={onToggle}
      className={cn(
        'size-[17px] shrink-0 rounded-[4px] border border-border-strong accent-foreground tablet:size-[19px]',
        className,
      )}
    />
  );
}

export default function ArchivedRow({
  card,
  selected,
  selectionMode,
  swipeEnabled,
  canAdminister,
  dx,
  tween,
  onOpen,
  onToggleSelect,
  onRestore,
  onExport,
  onDelete,
  onLongPress,
  onSwipeChange,
  onSwipeEnd,
}: {
  card: ArchivedTask;
  selected: boolean;
  selectionMode: boolean;
  swipeEnabled: boolean;
  canAdminister: boolean;
  dx: number;
  tween: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onRestore: () => void;
  onExport: () => void;
  onDelete: () => void;
  onLongPress: () => void;
  onSwipeChange: (dx: number) => void;
  onSwipeEnd: (dx: number) => void;
}) {
  const ignoreClickRef = useRef(false);
  const progress = subtaskProgress(card.subtasks);
  const tone = card.label ? labelToneClasses(card.label.tone) : null;
  const by = archivedByLine(card);
  const adminTitle = canAdminister ? undefined : archivedCopy.adminOnly;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, a')) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let fired = false;
    let lastDx = 0;
    const origin = event.currentTarget;
    origin.setPointerCapture?.(pointerId);

    const timer = window.setTimeout(() => {
      fired = true;
      if (navigator.vibrate) navigator.vibrate(10);
      ignoreClickRef.current = true;
      onLongPress();
    }, ARCHIVED_LONG_PRESS_MS);

    function onMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (Math.hypot(deltaX, deltaY) > ARCHIVED_LONG_PRESS_MOVE_PX) {
        window.clearTimeout(timer);
      }
      if (Math.abs(deltaX) > ARCHIVED_SWIPE_TAP_PX || Math.abs(deltaY) > ARCHIVED_SWIPE_TAP_PX) {
        moved = true;
        window.clearTimeout(timer);
      }
      if (!swipeEnabled || selectionMode || !moved) return;
      lastDx = Math.max(-ARCHIVED_SWIPE_LIMIT_PX, Math.min(ARCHIVED_SWIPE_LIMIT_PX, deltaX));
      onSwipeChange(lastDx);
    }

    function onUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      window.clearTimeout(timer);
      origin.releasePointerCapture?.(pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (fired) return;
      ignoreClickRef.current = true;
      if (!moved) {
        if (selectionMode) onToggleSelect();
        else onOpen();
        onSwipeEnd(0);
        return;
      }
      if (!swipeEnabled || selectionMode) {
        onSwipeEnd(0);
        return;
      }
      if (lastDx > ARCHIVED_SWIPE_COMMIT_PX) {
        if (canAdminister) onRestore();
        onSwipeEnd(0);
        return;
      }
      if (lastDx < -ARCHIVED_SWIPE_COMMIT_PX) {
        if (canAdminister) onDelete();
        onSwipeEnd(0);
        return;
      }
      if (lastDx > ARCHIVED_SWIPE_OPEN_PX) {
        onSwipeEnd(ARCHIVED_SWIPE_REST_PX);
        return;
      }
      if (lastDx < -ARCHIVED_SWIPE_OPEN_PX) {
        onSwipeEnd(-ARCHIVED_SWIPE_REST_PX);
        return;
      }
      onSwipeEnd(0);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  return (
    <div className="relative overflow-hidden tablet:overflow-visible">
      {swipeEnabled ? (
        <div className="absolute inset-0 flex tablet:hidden" aria-hidden>
          <div
            className={cn(
              'flex flex-1 items-center bg-ok-soft px-4 text-[13px] font-medium text-ok',
              dx > ARCHIVED_SWIPE_REVEAL_PX ? 'opacity-100' : 'opacity-0',
            )}
          >
            {archivedCopy.swipeRestore}
          </div>
          <div
            className={cn(
              'flex flex-1 items-center justify-end bg-danger-soft px-4 text-[13px] font-medium text-danger',
              dx < -ARCHIVED_SWIPE_REVEAL_PX ? 'opacity-100' : 'opacity-0',
            )}
          >
            {archivedCopy.swipeDelete}
          </div>
        </div>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (ignoreClickRef.current) {
            ignoreClickRef.current = false;
            return;
          }
          if (selectionMode) onToggleSelect();
          else onOpen();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (selectionMode) onToggleSelect();
            else onOpen();
          }
        }}
        onPointerDown={handlePointerDown}
        className={cn(
          'relative grid items-center gap-2.5 bg-card px-4 py-3 text-left tabular-nums transition-colors duration-150',
          'min-h-16 grid-cols-[auto_minmax(0,1fr)]',
          'tablet:min-h-0 tablet:grid-cols-[auto_minmax(0,1fr)_auto] tablet:px-4 tablet:py-3',
          'lg:grid-cols-[30px_minmax(0,1fr)_104px_88px_96px_120px_156px] lg:gap-2.5 lg:px-4 lg:py-3',
          selected && 'bg-foreground/4',
          'hover:bg-card-hover',
        )}
        style={
          swipeEnabled
            ? {
                transform: `translateX(${dx}px)`,
                transition: tween ? 'transform 0.18s ease' : 'none',
              }
            : undefined
        }
      >
        <ArchivedCheckbox
          checked={selected}
          label={`Select ${card.title}`}
          onToggle={onToggleSelect}
          className={cn(selectionMode ? 'block' : 'hidden lg:block')}
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {tone && card.label ? (
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-px text-[11px] font-medium',
                  tone.pill,
                )}
              >
                {card.label.name}
              </span>
            ) : null}
            <span className="truncate text-[14px] font-medium">{card.title}</span>
          </div>
          <p className="truncate text-[12px] text-subtle">{archivedTaskDetailLine(card)}</p>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-subtle tablet:hidden">
            <span>{card.column.title}</span>
            <span>
              {progress.done}/{progress.total}
            </span>
          </div>
        </div>
        <span className="hidden truncate text-[12.5px] lg:block">{card.column.title}</span>
        <span className="hidden text-[12.5px] tabular-nums lg:block">
          {progress.done}/{progress.total}
        </span>
        <div className="hidden items-center lg:flex">
          {card.assignees.slice(0, 3).map((person) => (
            <span
              key={person.id}
              title={person.name || person.username}
              className="-ml-1 inline-flex size-6 first:ml-0 items-center justify-center rounded-full border border-card bg-muted text-[9px] font-semibold"
            >
              {initials(person.name, person.username)}
            </span>
          ))}
        </div>
        <div className="hidden min-w-0 lg:block">
          <p className="text-[12.5px]">{formatArchivedDate(card.archivedAt)}</p>
          {by ? <p className="text-[11.5px] text-subtle">{by}</p> : null}
        </div>
        <div
          className={cn(
            'hidden justify-self-end gap-1',
            selectionMode ? 'lg:hidden' : 'tablet:flex',
          )}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            disabled={!canAdminister}
            title={adminTitle}
            onClick={onRestore}
            className={cn(
              shellFocusClassName,
              'hidden h-[30px] items-center rounded-md border border-border bg-surface px-[11px] text-[12.5px] font-medium hover:border-border-strong hover:bg-muted lg:inline-flex',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {archivedCopy.restore}
          </button>
          <button
            type="button"
            disabled={!canAdminister}
            title={adminTitle}
            aria-label={archivedCopy.restore}
            onClick={onRestore}
            className={cn(
              shellFocusClassName,
              'inline-flex size-[34px] items-center justify-center rounded-md border border-border bg-surface text-muted-foreground hover:border-border-strong lg:hidden',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <RotateCcw className="size-4" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            aria-label={archivedCopy.export}
            onClick={onExport}
            className={cn(
              shellFocusClassName,
              'hidden size-[30px] items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:inline-flex',
            )}
          >
            <Download className="size-3.5" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            disabled={!canAdminister}
            title={adminTitle}
            aria-label={archivedCopy.delete}
            onClick={onDelete}
            className={cn(
              shellFocusClassName,
              'inline-flex size-[34px] items-center justify-center rounded-md text-danger hover:border hover:border-danger-edge hover:bg-danger-soft lg:size-[30px]',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Trash2 className="size-3.5" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}
