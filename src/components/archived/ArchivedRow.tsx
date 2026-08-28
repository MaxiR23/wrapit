'use client';

import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Download, RotateCcw, Trash2 } from 'lucide-react';

import { shellFocusClassName } from '@/components/projects/shell';
import {
  ARCHIVED_LONG_PRESS_MOVE_PX,
  ARCHIVED_LONG_PRESS_MS,
  ARCHIVED_SWIPE_REVEAL_PX,
  archivedByLine,
  archivedProjectDetailLine,
  archivedTaskDetailLine,
  formatArchivedDate,
  type ArchivedPerson,
  type ArchivedProject,
  type ArchivedTask,
} from '@/lib/archived';
import { archivedCopy } from '@/lib/archivedCopy';
import { startRowPointer } from '@/lib/swipe';
import { subtaskProgress } from '@/lib/cardCounters';
import { initials } from '@/lib/initials';
import { labelToneClasses } from '@/lib/labelTones';
import { projectStatusBarClass } from '@/lib/projectGrid';
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

function TeamAvatars({ people }: { people: ArchivedPerson[] }) {
  return (
    <div className="hidden items-center lg:flex">
      {people.slice(0, 3).map((person) => (
        <span
          key={person.id}
          title={person.name || person.username}
          className="-ml-1 inline-flex size-6 first:ml-0 items-center justify-center rounded-full border border-card bg-muted text-[9px] font-semibold"
        >
          {initials(person.name, person.username)}
        </span>
      ))}
    </div>
  );
}

type RowChrome = {
  selected: boolean;
  selectionMode: boolean;
  swipeEnabled: boolean;
  canAdminister: boolean;
  canExport: boolean;
  adminOnly: string;
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
};

function ArchivedRowChrome({
  name,
  subtitle,
  label,
  mobileMeta,
  col2,
  col3,
  col4,
  archivedAt,
  archivedBy,
  selected,
  selectionMode,
  swipeEnabled,
  canAdminister,
  canExport,
  adminOnly,
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
}: RowChrome & {
  name: string;
  subtitle: string;
  label: ReactNode;
  mobileMeta: ReactNode;
  col2: ReactNode;
  col3: ReactNode;
  col4: ReactNode;
  archivedAt: Date;
  archivedBy: ArchivedPerson | null;
}) {
  const ignoreClickRef = useRef(false);
  const by = archivedByLine({ archivedBy });
  const adminTitle = canAdminister ? undefined : adminOnly;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    startRowPointer(event, {
      swipeEnabled,
      selectionMode,
      longPressMs: ARCHIVED_LONG_PRESS_MS,
      longPressMovePx: ARCHIVED_LONG_PRESS_MOVE_PX,
      onLongPress,
      onTap: () => {
        if (selectionMode) onToggleSelect();
        else onOpen();
      },
      suppressClickOnTap: true,
      onSuppressClick: () => {
        ignoreClickRef.current = true;
      },
      onSwipeChange,
      onSwipeEnd,
      onCommitPositive: onRestore,
      onCommitNegative: onDelete,
      canCommitPositive: canAdminister,
      canCommitNegative: canAdminister,
    });
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
          label={`Select ${name}`}
          onToggle={onToggleSelect}
          className={cn(selectionMode ? 'block' : 'hidden lg:block')}
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {label}
            <span className="truncate text-[14px] font-medium">{name}</span>
          </div>
          <p className="truncate text-[12px] text-subtle">{subtitle}</p>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-subtle tablet:hidden">
            {mobileMeta}
          </div>
        </div>
        {col2}
        {col3}
        {col4}
        <div className="hidden min-w-0 lg:block">
          <p className="text-[12.5px]">{formatArchivedDate(archivedAt)}</p>
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
          {canExport ? (
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
          ) : null}
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

export default function ArchivedRow({
  card,
  project,
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
  card?: ArchivedTask;
  project?: ArchivedProject;
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
  const chrome = {
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
  };

  if (project) {
    return (
      <ArchivedRowChrome
        {...chrome}
        name={project.title}
        subtitle={archivedProjectDetailLine(project)}
        label={null}
        mobileMeta={
          <>
            <span>{project.statusLabel}</span>
            <span>{project.percent}%</span>
          </>
        }
        col2={<span className="hidden truncate text-[12.5px] lg:block">{project.statusLabel}</span>}
        col3={
          <div className="hidden items-center gap-1.5 lg:flex">
            <span className="block h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn('block h-full rounded-full', projectStatusBarClass(project.status))}
                style={{ width: `${project.percent}%` }}
              />
            </span>
            <span className="text-[12.5px] tabular-nums">{project.percent}%</span>
          </div>
        }
        col4={<TeamAvatars people={project.members} />}
        archivedAt={project.archivedAt}
        archivedBy={project.archivedBy}
        canExport={false}
        adminOnly={archivedCopy.projects.adminOnly}
      />
    );
  }

  if (!card) return null;

  const progress = subtaskProgress(card.subtasks);
  const tone = card.label ? labelToneClasses(card.label.tone) : null;

  return (
    <ArchivedRowChrome
      {...chrome}
      name={card.title}
      subtitle={archivedTaskDetailLine(card)}
      label={
        tone && card.label ? (
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-px text-[11px] font-medium',
              tone.pill,
            )}
          >
            {card.label.name}
          </span>
        ) : null
      }
      mobileMeta={
        <>
          <span>{card.column.title}</span>
          <span>
            {progress.done}/{progress.total}
          </span>
        </>
      }
      col2={<span className="hidden truncate text-[12.5px] lg:block">{card.column.title}</span>}
      col3={
        <span className="hidden text-[12.5px] tabular-nums lg:block">
          {progress.done}/{progress.total}
        </span>
      }
      col4={<TeamAvatars people={card.assignees} />}
      archivedAt={card.archivedAt}
      archivedBy={card.archivedBy}
      canExport
      adminOnly={archivedCopy.adminOnly}
    />
  );
}
