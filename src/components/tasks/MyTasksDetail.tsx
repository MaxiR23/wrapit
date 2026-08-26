'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import MyTasksDetailBody from '@/components/tasks/MyTasksDetailBody';
import { canEditBoard } from '@/lib/boardAccess';
import type { MyTask } from '@/lib/myTasks';
import { projectCardPath } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';

export default function MyTasksDetail({
  task,
  onClose,
  onToggleComplete,
  pending = false,
}: {
  task: MyTask;
  onClose: () => void;
  onToggleComplete: () => void;
  pending?: boolean;
}) {
  const canEdit = canEditBoard(task.project.access);
  const completeLabel = task.completed ? 'Mark as pending' : 'Mark as completed';
  const boardHref = projectCardPath(task.project.id, task.id);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="contents">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[55] bg-black/22 tablet:block"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-task-detail-title"
        className={cn(
          'fixed z-[60] flex flex-col bg-surface',
          'inset-x-0 bottom-0 max-h-[84%] rounded-t-[16px] border-t border-border-strong',
          'tablet:inset-y-0 tablet:right-0 tablet:left-auto tablet:max-h-none tablet:w-[340px] tablet:rounded-none tablet:border-t-0 tablet:border-l',
          'lg:w-[392px]',
          'shadow-[0_-12px_40px_oklch(0_0_0/0.35)] tablet:shadow-[-24px_0_60px_oklch(0_0_0/0.45)]',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-[38px] rounded-full bg-border tablet:hidden" />
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 tablet:h-[60px] lg:h-16 lg:px-[22px]">
          <p
            id="my-task-detail-title"
            className="mr-auto text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase"
          >
            Task detail
          </p>
          <Link
            href={boardHref}
            className={cn(
              shellFocusClassName,
              'rounded-md text-[12.5px] font-medium text-foreground no-underline hover:underline',
            )}
          >
            <span className="tablet:hidden lg:inline">Open on the board</span>
            <span className="hidden tablet:inline lg:hidden">To the board</span>
          </Link>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={cn(
              shellFocusClassName,
              'inline-flex size-[30px] items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground',
            )}
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <MyTasksDetailBody task={task} />
        </div>
        <footer className="flex flex-col gap-2 border-t border-border p-4 tablet:p-[18px]">
          <button
            type="button"
            disabled={!canEdit || pending}
            onClick={() => {
              onToggleComplete();
            }}
            className={cn(
              shellFocusClassName,
              'h-12 rounded-md text-[13.5px] font-semibold tablet:h-11 lg:h-[42px]',
              task.completed
                ? 'border border-border bg-background text-foreground hover:bg-card'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50',
            )}
          >
            {completeLabel}
          </button>
          <Link
            href={boardHref}
            className={cn(
              shellFocusClassName,
              'flex h-12 items-center justify-center rounded-md border border-border text-[13.5px] font-semibold no-underline tablet:hidden',
            )}
          >
            Open on the board
          </Link>
        </footer>
      </aside>
    </div>
  );
}
