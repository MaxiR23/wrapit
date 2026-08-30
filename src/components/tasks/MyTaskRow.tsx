'use client';

import { Check } from 'lucide-react';
import { useId, type KeyboardEvent, type MouseEvent } from 'react';

import CardMarkdown from '@/components/cards/CardMarkdown';
import { canEditBoard } from '@/lib/boardAccess';
import { subtaskProgress } from '@/lib/cardCounters';
import { cardDueLabel } from '@/lib/cardDue';
import { initials } from '@/lib/initials';
import { labelToneClasses } from '@/lib/labelTones';
import type { MyTask } from '@/lib/myTasks';
import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';
import { useViewerTimeZone } from '@/components/projects/ViewerTimeZoneProvider';

function isNestedControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('a, button, input'));
}

export default function MyTaskRow({
  task,
  active = false,
  completed = false,
  pending = false,
  onOpen,
  onToggleComplete,
}: {
  task: MyTask;
  active?: boolean;
  completed?: boolean;
  pending?: boolean;
  onOpen: () => void;
  onToggleComplete: () => void;
}) {
  const viewerTimeZone = useViewerTimeZone();
  const titleId = useId();
  const canEdit = canEditBoard(task.project.access);
  const progress = subtaskProgress(task.subtasks);
  const due =
    task.dueDate != null
      ? cardDueLabel({ dueDate: task.dueDate, dueTimeZone: task.dueTimeZone }, { viewerTimeZone })
      : null;
  const tone = task.label ? labelToneClasses(task.label.tone) : null;
  const completeLabel = completed ? 'Mark as pending' : 'Mark as completed';

  function openFromRow(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) {
    if (isNestedControl(event.target)) return;
    onOpen();
  }

  return (
    <article
      tabIndex={0}
      aria-labelledby={titleId}
      onClick={openFromRow}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (isNestedControl(event.target)) return;
        event.preventDefault();
        onOpen();
      }}
      className={cn(
        shellFocusClassName,
        'grid items-center gap-x-3.5 rounded-[10px] border border-border bg-card px-4 py-[13px] tabular-nums transition-[background,border-color] duration-150',
        'grid-cols-[18px_minmax(0,1fr)]',
        'tablet:grid-cols-[20px_minmax(0,1fr)_auto] tablet:px-3.5 tablet:py-3',
        'lg:grid-cols-[24px_minmax(0,1fr)_132px_150px_108px_72px] lg:gap-x-3.5 lg:px-4',
        active && 'border-border-strong bg-card-hover',
        completed && 'opacity-[0.72]',
      )}
    >
      <button
        type="button"
        title={completeLabel}
        aria-label={completeLabel}
        aria-pressed={completed}
        disabled={!canEdit || pending}
        onClick={(event) => {
          event.stopPropagation();
          onToggleComplete();
        }}
        className={cn(
          shellFocusClassName,
          'inline-flex size-[18px] items-center justify-center rounded-full border-[1.5px] border-border-strong',
          'hover:border-foreground disabled:opacity-50',
          completed && 'border-foreground bg-foreground text-primary-foreground',
        )}
      >
        {completed ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </button>

      <div
        className={cn(
          'min-w-0 text-left',
          'tablet:flex tablet:flex-col tablet:gap-0.5',
          'lg:contents',
        )}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            id={titleId}
            className={cn(
              'truncate text-[15px] font-medium tablet:text-sm',
              completed ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            <CardMarkdown text={task.title} variant="inline" />
          </span>
          {progress.total > 0 ? (
            <span className="text-xs text-subtle">
              {progress.done}/{progress.total} subtasks
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground tablet:hidden">
            {task.label ? (
              <span className={cn('truncate', tone?.text)}>{task.label.name}</span>
            ) : null}
            {task.label ? <span className="text-subtle">·</span> : null}
            <span className="truncate">{task.project.title}</span>
            {due ? <span className="text-subtle">·</span> : null}
            {due ? (
              <span className={cn('shrink-0', due.late && 'text-late')}>{due.text}</span>
            ) : null}
          </span>
          <span className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground tablet:flex lg:hidden">
            {task.label ? (
              <span className={cn('truncate', tone?.text)}>{task.label.name}</span>
            ) : null}
            {task.label ? <span className="text-subtle">·</span> : null}
            <span className="truncate">{task.project.title}</span>
          </span>
        </span>
        {task.label ? (
          <span
            className={cn(
              'hidden max-w-[132px] truncate rounded-full border px-2 py-0.5 text-[12px] lg:inline-flex',
              tone?.pill,
            )}
          >
            {task.label.name}
          </span>
        ) : (
          <span className="hidden lg:block" />
        )}
        <span className="hidden truncate text-xs text-muted-foreground lg:block">
          {task.project.title}
        </span>
        <span
          className={cn(
            'hidden text-right text-[12.5px] tablet:block lg:text-left',
            due?.late ? 'text-late' : 'text-muted-foreground',
          )}
        >
          {due?.text ?? ''}
        </span>
        <span className="hidden justify-end -space-x-1 tablet:flex">
          {task.assignees.slice(0, 3).map((assignee) => (
            <span
              key={assignee.id}
              title={assignee.name}
              className="inline-flex size-6 items-center justify-center rounded-full border border-border bg-muted text-[9.5px] font-semibold text-foreground tablet:size-[22px] lg:size-6"
            >
              {initials(assignee.name, assignee.username)}
            </span>
          ))}
        </span>
      </div>
    </article>
  );
}
