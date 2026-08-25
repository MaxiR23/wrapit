'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';

import { createCard } from '@/actions/createCard';
import NewCardFields from '@/components/cards/NewCardFields';
import type { BoardCardData, BoardMember } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cardLabelFromRow, type LabelView } from '@/lib/labels';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { cn } from '@/lib/utils';

export type CreatedBoardCard = BoardCardData & { columnId: string };

function emptyDraft(columnId: string, labels: LabelView[]) {
  return {
    title: '',
    description: '',
    columnId,
    labelId: labels[0]?.id ?? '',
    assigneeIds: [] as string[],
    dueDate: '',
  };
}

export default function NewCardDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  initialColumnId,
  columns,
  members,
  labels,
  onLabelsChange,
  onCreated,
  onRestoreFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  initialColumnId: string;
  columns: Array<{ id: string; title: string }>;
  members: BoardMember[];
  labels: LabelView[];
  onLabelsChange: (labels: LabelView[]) => void;
  onCreated: (card: CreatedBoardCard) => void;
  onRestoreFocus?: () => void;
}) {
  const formId = useId();
  const labelsRef = useRef(labels);
  useLayoutEffect(() => {
    labelsRef.current = labels;
  });
  const [draft, setDraft] = useState(() => emptyDraft(initialColumnId, labels));
  const [titleError, setTitleError] = useState<string | undefined>();
  const [descriptionError, setDescriptionError] = useState<string | undefined>();
  const [dueDateError, setDueDateError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft(initialColumnId, labelsRef.current));
    setTitleError(undefined);
    setDescriptionError(undefined);
    setDueDateError(undefined);
    setFormError(null);
    setSubmitting(false);
  }, [open, initialColumnId]);

  const selectedColumn = columns.find((column) => column.id === draft.columnId);
  const columnTitle = selectedColumn?.title ?? '';
  const canCreate = draft.title.trim().length > 0 && !submitting;

  function toggleAssignee(userId: string) {
    setDraft((current) => {
      const selected = current.assigneeIds.includes(userId);
      return {
        ...current,
        assigneeIds: selected
          ? current.assigneeIds.filter((id) => id !== userId)
          : [...current.assigneeIds, userId],
      };
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setFormError(null);
    setTitleError(undefined);
    setDescriptionError(undefined);
    setDueDateError(undefined);
    setSubmitting(true);

    const result = await createCard({
      columnId: draft.columnId,
      title: draft.title,
      description: draft.description,
      ...(draft.labelId ? { labelId: draft.labelId } : {}),
      ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      ...(draft.assigneeIds.length > 0 ? { assigneeIds: draft.assigneeIds } : {}),
    });

    if ('fieldErrors' in result) {
      setTitleError(result.fieldErrors.title);
      setDescriptionError(result.fieldErrors.description);
      setDueDateError(result.fieldErrors.dueDate);
      setSubmitting(false);
      return;
    }

    if ('error' in result) {
      setFormError(GENERIC_ERROR_MESSAGE);
      setSubmitting(false);
      return;
    }

    const labelRow = result.data.labelId
      ? labels.find((label) => label.id === result.data.labelId)
      : undefined;
    onCreated({
      id: result.data.id,
      title: result.data.title,
      code: result.data.code,
      dueDate: result.data.dueDate,
      label: cardLabelFromRow(labelRow),
      assignees: result.data.assignees,
      comments: result.data.comments ?? [],
      subtasks: result.data.subtasks ?? [],
      description: result.data.description,
      columnId: result.data.columnId,
    });
    setSubmitting(false);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-modal="true"
        overlayClassName="z-[80] bg-black/62"
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus?.();
        }}
        className={cn(
          'z-[80] flex flex-col gap-0 overflow-hidden border bg-surface p-0 text-foreground',
          'top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 shadow-none sm:max-w-none',
          'tablet:top-1/2 tablet:left-1/2 tablet:h-auto tablet:max-h-full tablet:w-full tablet:max-w-[540px]',
          'tablet:-translate-x-1/2 tablet:-translate-y-1/2 tablet:rounded-[14px] tablet:border tablet:border-border-strong',
          'tablet:shadow-[0_30px_70px_oklch(0_0_0/0.6)] tablet:sm:max-w-[540px]',
        )}
      >
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void onSubmit(event)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex items-center gap-2.5 border-b border-border px-4 pt-0.5 pb-2.5 tablet:hidden">
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                className={cn(
                  shellFocusClassName,
                  '-ml-2 inline-flex size-[38px] shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground',
                )}
              >
                <X className="size-[18px]" strokeWidth={1.8} />
              </button>
            </DialogClose>
            <div className="mr-auto flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="text-[15.5px] font-semibold tracking-[-0.01em]">
                New task
              </DialogTitle>
              <DialogDescription className="truncate text-xs text-muted-foreground">
                In {columnTitle}
              </DialogDescription>
            </div>
            <Button
              type="submit"
              disabled={!canCreate}
              className="h-9 px-[15px] text-[13.5px] font-semibold disabled:opacity-45"
            >
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </div>

          <DialogHeader className="hidden flex-row items-center gap-3 border-b border-border p-[18px_20px] tablet:flex">
            <div className="mr-auto flex min-w-0 flex-col gap-[3px]">
              <DialogTitle className="text-base font-semibold tracking-[-0.01em]">
                New task
              </DialogTitle>
              <DialogDescription className="truncate text-[12.5px] text-muted-foreground">
                In {projectTitle} · {columnTitle}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                className={cn(
                  shellFocusClassName,
                  'inline-flex size-[30px] shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-card hover:text-foreground',
                )}
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
            </DialogClose>
          </DialogHeader>

          {formError ? (
            <p role="alert" className="px-4 pt-4 text-sm text-destructive tablet:px-5">
              {formError}
            </p>
          ) : null}

          <NewCardFields
            projectId={projectId}
            columns={columns}
            members={members}
            labels={labels}
            onLabelsChange={onLabelsChange}
            title={draft.title}
            onTitleChange={(title) => setDraft((current) => ({ ...current, title }))}
            description={draft.description}
            onDescriptionChange={(description) =>
              setDraft((current) => ({ ...current, description }))
            }
            titleError={titleError}
            descriptionError={descriptionError}
            dueDateError={dueDateError}
            columnId={draft.columnId}
            onColumnIdChange={(columnId) => setDraft((current) => ({ ...current, columnId }))}
            labelId={draft.labelId}
            onLabelIdChange={(labelId) => setDraft((current) => ({ ...current, labelId }))}
            assigneeIds={draft.assigneeIds}
            onToggleAssignee={toggleAssignee}
            dueDate={draft.dueDate}
            onDueDateChange={(dueDate) => setDraft((current) => ({ ...current, dueDate }))}
          />

          <div className="hidden items-center gap-2 border-t border-border p-4 px-5 tablet:flex">
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="ml-auto h-9 px-3.5 text-[13px]">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!canCreate}
              className="h-9 px-4 text-[13px] font-semibold disabled:opacity-45"
            >
              {submitting ? 'Creating...' : 'Create task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
