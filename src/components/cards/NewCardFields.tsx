'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';

import LabelEditor from '@/components/labels/LabelEditor';
import type { BoardMember } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { initials } from '@/lib/initials';
import { labelToneClasses } from '@/lib/labelTones';
import type { LabelView } from '@/lib/labels';
import { cn } from '@/lib/utils';

export default function NewCardFields({
  projectId,
  columns,
  members,
  labels,
  onLabelsChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  titleError,
  descriptionError,
  dueDateError,
  columnId,
  onColumnIdChange,
  labelId,
  onLabelIdChange,
  assigneeIds,
  onToggleAssignee,
  dueDate,
  onDueDateChange,
}: {
  projectId: string;
  columns: Array<{ id: string; title: string }>;
  members: BoardMember[];
  labels: LabelView[];
  onLabelsChange: (labels: LabelView[]) => void;
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  titleError?: string;
  descriptionError?: string;
  dueDateError?: string;
  columnId: string;
  onColumnIdChange: (columnId: string) => void;
  labelId: string;
  onLabelIdChange: (labelId: string) => void;
  assigneeIds: string[];
  onToggleAssignee: (userId: string) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
}) {
  const [editingLabels, setEditingLabels] = useState(false);
  const selectedAssignees = new Set(assigneeIds);

  function handleLabelsChange(next: LabelView[]) {
    onLabelsChange(next);
    if (labelId && !next.some((label) => label.id === labelId)) {
      onLabelIdChange(next[0]?.id ?? '');
    }
  }

  return (
    <div className="flex flex-col gap-5 overflow-auto px-4 py-[18px] tablet:gap-[18px] tablet:p-5">
      <Field data-invalid={Boolean(titleError)} className="gap-2 tablet:gap-[7px]">
        <FieldLabel
          htmlFor="new-card-title"
          className="text-[12.5px] font-medium text-muted-foreground tablet:text-xs"
        >
          Title
        </FieldLabel>
        <Input
          id="new-card-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="What needs doing"
          autoComplete="off"
          autoFocus
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? 'new-card-title-error' : undefined}
          className="h-11 rounded-md bg-background px-[13px] text-[14.5px] tablet:h-[38px] tablet:px-3 tablet:text-[13.5px]"
        />
        {titleError ? <FieldError id="new-card-title-error">{titleError}</FieldError> : null}
      </Field>

      <Field data-invalid={Boolean(descriptionError)} className="gap-2 tablet:gap-[7px]">
        <FieldLabel
          htmlFor="new-card-description"
          className="text-[12.5px] font-medium text-muted-foreground tablet:text-xs"
        >
          Description
        </FieldLabel>
        <Textarea
          id="new-card-description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={3}
          placeholder="Context, acceptance criteria, links"
          aria-invalid={Boolean(descriptionError)}
          className="min-h-0 resize-none rounded-md bg-background px-[13px] py-[11px] text-sm leading-[1.55] tablet:px-3 tablet:py-2.5 tablet:text-[13.5px] tablet:leading-normal"
        />
        {descriptionError ? <FieldError>{descriptionError}</FieldError> : null}
      </Field>

      <Field className="gap-2 tablet:gap-[7px]">
        <FieldLabel className="text-[12.5px] font-medium text-muted-foreground tablet:text-xs">
          Column
        </FieldLabel>
        <div
          role="group"
          aria-label="Column"
          className="grid grid-cols-2 gap-1.5 tablet:flex tablet:gap-[3px] tablet:rounded-md tablet:border tablet:border-border tablet:bg-background tablet:p-[3px]"
        >
          {columns.map((column) => {
            const selected = column.id === columnId;
            return (
              <button
                key={column.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onColumnIdChange(column.id)}
                className={cn(
                  shellFocusClassName,
                  'h-10 rounded-md border text-[13px] font-medium tablet:h-[30px] tablet:flex-1 tablet:rounded-[6px] tablet:border-0 tablet:text-[12.5px]',
                  selected
                    ? 'border-border-strong bg-card text-foreground'
                    : 'border-border bg-transparent text-muted-foreground',
                )}
              >
                {column.title}
              </button>
            );
          })}
        </div>
      </Field>

      <Field className="gap-2 tablet:gap-[7px]">
        <FieldLabel className="text-[12.5px] font-medium text-muted-foreground tablet:text-xs">
          Label
        </FieldLabel>
        {editingLabels ? (
          <LabelEditor
            projectId={projectId}
            labels={labels}
            onLabelsChange={handleLabelsChange}
            onDone={() => setEditingLabels(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {labels.map((label) => {
              const selected = label.id === labelId;
              const tone = labelToneClasses(label.tone);
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onLabelIdChange(label.id)}
                  className={cn(
                    shellFocusClassName,
                    'rounded-full border px-3.5 py-2 text-[12.5px] font-medium tablet:px-3 tablet:py-[5px] tablet:text-[11.5px]',
                    selected ? tone.pill : 'border-border bg-transparent text-muted-foreground',
                  )}
                >
                  {label.name}
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Edit labels"
              aria-pressed={editingLabels}
              onClick={() => setEditingLabels(true)}
              className={cn(
                shellFocusClassName,
                'inline-flex size-[30px] items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground tablet:size-6',
              )}
            >
              <Pencil className="size-3.5" strokeWidth={1.8} />
            </button>
          </div>
        )}
      </Field>

      <div className="flex flex-col gap-5 tablet:grid tablet:grid-cols-[minmax(0,1fr)_168px] tablet:gap-4">
        <Field className="gap-2 tablet:gap-[7px]">
          <FieldLabel className="text-[12.5px] font-medium text-muted-foreground tablet:text-xs">
            Assignees
          </FieldLabel>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => {
              const selected = selectedAssignees.has(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  title={member.name}
                  aria-label={member.name}
                  aria-pressed={selected}
                  onClick={() => onToggleAssignee(member.id)}
                  className={cn(
                    shellFocusClassName,
                    'inline-flex size-10 shrink-0 items-center justify-center rounded-full border text-[12.5px] font-semibold leading-none tablet:size-8 tablet:text-[11px]',
                    selected
                      ? 'border-foreground bg-foreground text-primary-foreground'
                      : 'border-border-strong bg-transparent text-muted-foreground',
                  )}
                >
                  {initials(member.name, member.username)}
                </button>
              );
            })}
          </div>
        </Field>

        <Field data-invalid={Boolean(dueDateError)} className="gap-2 tablet:gap-[7px]">
          <FieldLabel
            htmlFor="new-card-due"
            className="text-[12.5px] font-medium text-muted-foreground tablet:text-xs"
          >
            Due date
          </FieldLabel>
          <Input
            id="new-card-due"
            type="date"
            value={dueDate}
            onChange={(event) => onDueDateChange(event.target.value)}
            aria-invalid={Boolean(dueDateError)}
            className="h-11 rounded-md bg-background px-[13px] text-[14.5px] tablet:h-[38px] tablet:px-3 tablet:text-[13.5px]"
          />
          {dueDateError ? <FieldError>{dueDateError}</FieldError> : null}
        </Field>
      </div>
    </div>
  );
}
