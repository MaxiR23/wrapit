'use client';

import type { ReactNode } from 'react';

import { subtaskProgress } from '@/lib/cardCounters';
import { cardDueLabel } from '@/lib/cardDue';
import { initials } from '@/lib/initials';
import { labelToneClasses } from '@/lib/labelTones';
import type { MyTask } from '@/lib/myTasks';
import { cn } from '@/lib/utils';
import { useViewerTimeZone } from '@/components/projects/ViewerTimeZoneProvider';

export default function MyTasksDetailBody({ task }: { task: MyTask }) {
  const viewerTimeZone = useViewerTimeZone();
  const progress = subtaskProgress(task.subtasks);
  const due =
    task.dueDate != null
      ? cardDueLabel(
          { dueDate: task.dueDate, dueTimeZone: task.dueTimeZone },
          { viewerTimeZone, style: 'long' },
        )
      : null;
  const tone = task.label ? labelToneClasses(task.label.tone) : null;

  return (
    <div className="flex flex-col gap-[22px] px-[22px] py-[22px]">
      <div className="flex flex-wrap items-center gap-2">
        {task.label ? (
          <span className={cn('rounded-full border px-2 py-0.5 text-[12px]', tone?.pill)}>
            {task.label.name}
          </span>
        ) : null}
        <span className="text-[12.5px] text-muted-foreground">{task.project.title}</span>
      </div>
      <h2 className="text-lg font-semibold tracking-[-0.02em] lg:text-xl">{task.title}</h2>
      <dl className="flex flex-col gap-px overflow-hidden rounded-md bg-border">
        <DetailRow label="Due date">
          <span className={due?.late ? 'text-late' : undefined}>{due?.text ?? 'No date'}</span>
        </DetailRow>
        <DetailRow label="Subtasks">
          {progress.total === 0 ? 'No subtasks' : `${progress.done} of ${progress.total}`}
        </DetailRow>
        <DetailRow label="Assigned to">
          <span className="flex justify-end gap-1">
            {task.assignees.map((assignee) => (
              <span
                key={assignee.id}
                title={assignee.name}
                className="inline-flex size-[26px] items-center justify-center rounded-full bg-muted text-[10px] font-semibold"
              >
                {initials(assignee.name, assignee.username)}
              </span>
            ))}
          </span>
        </DetailRow>
      </dl>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-surface px-3 py-3">
      <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] text-foreground">{children}</dd>
    </div>
  );
}
