'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, X } from 'lucide-react';

import { createCard } from '@/actions/createCard';
import DueDateField, { splitDueValue } from '@/components/cards/DueDateField';
import { shellFocusClassName } from '@/components/projects/shell';
import { useViewerTimeZone } from '@/components/projects/ViewerTimeZoneProvider';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import type { MyTask, MyTasksCreateProject } from '@/lib/myTasks';
import { cn } from '@/lib/utils';

export default function NewTaskPopover({
  open,
  onOpenChange,
  projects,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: MyTasksCreateProject[];
  onCreated: (task: MyTask) => void;
}) {
  const titleId = useId();
  const viewerTimeZone = useViewerTimeZone();
  const [step, setStep] = useState<1 | 2>(1);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [dueDateError, setDueDateError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      requestIdRef.current += 1;
    };
  }, [open, onOpenChange]);

  const selected = projects.find((project) => project.id === projectId);
  const canCreate = title.trim().length > 0 && !submitting && selected != null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !title.trim()) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const selectedProject = selected;
    setSubmitting(true);
    setFormError(null);
    setTitleError(undefined);
    setDueDateError(undefined);
    const due = splitDueValue(dueDate);
    const result = await createCard({
      columnId: selectedProject.inboxColumnId,
      title,
      ...(due.day ? { dueDate: due.day } : {}),
      ...(due.day && due.time ? { dueTime: due.time, dueTimeZone: viewerTimeZone ?? '' } : {}),
    });
    if (requestId !== requestIdRef.current) return;
    if ('fieldErrors' in result) {
      setTitleError(result.fieldErrors.title);
      setDueDateError(
        result.fieldErrors.dueDate ?? result.fieldErrors.dueTime ?? result.fieldErrors.dueTimeZone,
      );
      setSubmitting(false);
      return;
    }
    if ('error' in result) {
      setFormError(GENERIC_ERROR_MESSAGE);
      setSubmitting(false);
      return;
    }
    onCreated({
      id: result.data.id,
      title: result.data.title,
      dueDate: result.data.dueDate,
      dueTimeZone: result.data.dueTimeZone,
      label: null,
      subtasks: [],
      assignees: result.data.assignees,
      project: { id: selectedProject.id, title: selectedProject.title, access: 'EDIT' },
      columnId: result.data.columnId,
      completed: false,
    });
    setSubmitting(false);
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <div className="contents">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[65] bg-black/40 tablet:bg-transparent"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'fixed z-[70] flex flex-col bg-surface',
          'inset-x-0 bottom-0 max-h-[84%] rounded-t-[16px] border border-border-strong',
          'tablet:absolute tablet:inset-auto tablet:top-full tablet:right-0 tablet:mt-2 tablet:w-[300px] tablet:rounded-[12px]',
          'shadow-[0_20px_50px_oklch(0_0_0/0.55)]',
        )}
      >
        {step === 1 ? (
          <div className="flex flex-col p-3">
            <div className="flex items-center gap-2 px-1 pb-2">
              <p
                id={titleId}
                className="mr-auto text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase"
              >
                Which project?
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className={cn(shellFocusClassName, 'size-8 rounded-md text-muted-foreground')}
              >
                <X className="mx-auto size-4" />
              </button>
            </div>
            {projects.length === 0 ? (
              <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                You need edit access on a project to create a task.
              </p>
            ) : (
              <ul className="flex flex-col">
                {projects.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectId(project.id);
                        setStep(2);
                      }}
                      className={cn(
                        shellFocusClassName,
                        'h-12 w-full rounded-md px-2.5 text-left text-[13.5px] hover:bg-card tablet:h-auto tablet:py-[9px]',
                      )}
                    >
                      {project.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <form className="flex flex-col gap-3 p-3" onSubmit={onSubmit}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Change project"
                onClick={() => setStep(1)}
                className={cn(shellFocusClassName, 'size-8 rounded-md text-muted-foreground')}
              >
                <ArrowLeft className="mx-auto size-4" />
              </button>
              <p id={titleId} className="mr-auto text-[12.5px] text-muted-foreground">
                {selected?.title}
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className={cn(shellFocusClassName, 'size-8 rounded-md text-muted-foreground')}
              >
                <X className="mx-auto size-4" />
              </button>
            </div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs doing?"
              aria-label="Title"
              aria-invalid={Boolean(titleError)}
              className={cn(
                shellFocusClassName,
                'h-[38px] rounded-md border border-input bg-background px-3 text-[13.5px]',
              )}
            />
            {titleError ? <p className="text-[12.5px] text-destructive">{titleError}</p> : null}
            <DueDateField
              idPrefix="my-task-due"
              value={dueDate}
              onChange={setDueDate}
              variant="form"
              error={dueDateError}
              hintTimeZone={viewerTimeZone}
            />
            {dueDateError ? <p className="text-[12.5px] text-destructive">{dueDateError}</p> : null}
            {formError ? <p className="text-[12.5px] text-destructive">{formError}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className={cn(
                  shellFocusClassName,
                  'hidden h-9 rounded-md px-3 text-[13px] text-muted-foreground tablet:inline-flex tablet:items-center',
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canCreate}
                className={cn(
                  shellFocusClassName,
                  'h-12 w-full rounded-md text-[13.5px] font-semibold tablet:h-9 tablet:w-auto tablet:px-3.5',
                  canCreate ? 'bg-primary text-primary-foreground' : 'bg-muted text-subtle',
                )}
              >
                <span className="tablet:hidden">Create task</span>
                <span className="hidden tablet:inline">Create</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
