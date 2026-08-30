'use client';

import { useRef } from 'react';
import { Archive, Trash2 } from 'lucide-react';

import DueDateField, { splitDueValue } from '@/components/cards/DueDateField';
import EditableServiceText from '@/components/cards/EditableServiceText';

import { updateCardAssignees } from '@/actions/updateCardAssignees';
import { updateCardField } from '@/actions/updateCardField';
import { updateCardLabel } from '@/actions/updateCardLabel';
import {
  PROFILE_AUTOSAVE_DEBOUNCE_MS,
  useProfileAutosave,
} from '@/components/account/useProfileAutosave';
import CardCommentThread, { CardCommentComposer } from '@/components/cards/CardCommentThread';
import CardSubtaskList from '@/components/cards/CardSubtaskList';
import type { BoardCardData, BoardMember } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { useViewerTimeZone } from '@/components/projects/ViewerTimeZoneProvider';
import { cardDueLabel, calendarDayFromDueDate, zonedWallTime } from '@/lib/cardDue';
import { initials } from '@/lib/initials';
import { labelToneClasses } from '@/lib/labelTones';
import { cardLabelFromRow, type LabelView } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** A stored due date as the control shows it: a day, or a day plus a wall time. */
function dueControlValue(card: BoardCardData, viewerTimeZone: string | null): string {
  if (card.dueDate == null) return '';
  const storedZone = card.dueTimeZone ?? null;
  if (storedZone == null) return calendarDayFromDueDate(card.dueDate);
  const wall = zonedWallTime(card.dueDate, viewerTimeZone ?? storedZone);
  return `${wall.day}T${wall.time}`;
}

export default function CardDetailBody({
  card,
  columnId,
  columns,
  members,
  labels,
  currentUser,
  canEdit = true,
  canComment = true,
  askingDelete,
  onAskingDelete,
  onCardPatch,
  onMoveColumn,
  onArchive,
  onDelete,
}: {
  card: BoardCardData;
  columnId: string;
  columns: Array<{ id: string; title: string }>;
  members: BoardMember[];
  labels: LabelView[];
  currentUser: BoardMember;
  canEdit?: boolean;
  canComment?: boolean;
  askingDelete: boolean;
  onAskingDelete: (value: boolean) => void;
  onCardPatch: (patch: Partial<BoardCardData>) => void;
  onMoveColumn: (columnId: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const comments = card.comments ?? [];
  const subtasks = card.subtasks ?? [];
  const viewerTimeZone = useViewerTimeZone();
  const dueInitial = dueControlValue(card, viewerTimeZone);
  // The server owns every wall-time-to-instant conversion, so the resolved due
  // date comes back from the action rather than being recomputed here.
  const resolvedDueRef = useRef(new Map<string, Pick<BoardCardData, 'dueDate' | 'dueTimeZone'>>());
  function patchDue(value: string) {
    const resolved = resolvedDueRef.current.get(value);
    if (resolved) onCardPatch(resolved);
  }
  const due = useProfileAutosave({
    initial: dueInitial,
    debounceMs: PROFILE_AUTOSAVE_DEBOUNCE_MS,
    resetKey: viewerTimeZone,
    save: async (value) => {
      const { day, time } = splitDueValue(value);
      const result = await updateCardField({
        cardId: card.id,
        field: 'dueDate',
        value: day,
        ...(time === '' ? {} : { time, timeZone: viewerTimeZone ?? undefined }),
      });
      if ('data' in result) {
        resolvedDueRef.current.set(result.data.value, {
          dueDate: result.data.dueDate ?? null,
          dueTimeZone: result.data.dueTimeZone ?? null,
        });
      }
      return result;
    },
    onSuccess: patchDue,
    onRevert: patchDue,
  });

  const assigneeIdsRef = useRef((card.assignees ?? []).map((member) => member.id));
  function patchAssignees(ids: string[]) {
    assigneeIdsRef.current = ids;
    onCardPatch({
      assignees: ids.flatMap((id) => {
        const member = members.find((item) => item.id === id);
        return member ? [member] : [];
      }),
    });
  }
  function patchLabel(labelId: string | null) {
    onCardPatch({
      label: labelId == null ? null : cardLabelFromRow(labels.find((item) => item.id === labelId)),
    });
  }
  const assignees = useProfileAutosave({
    initial: (card.assignees ?? []).map((member) => member.id),
    debounceMs: 0,
    save: async (assigneeIds) => {
      const result = await updateCardAssignees({ cardId: card.id, assigneeIds });
      if ('error' in result) return result;
      return { data: { value: assigneeIds } };
    },
    onSuccess: patchAssignees,
    onRevert: patchAssignees,
  });

  const label = useProfileAutosave({
    initial: card.label?.id ?? null,
    debounceMs: 0,
    save: async (labelId) => {
      const result = await updateCardLabel({ cardId: card.id, labelId });
      if ('error' in result) return result;
      return { data: { value: result.data.labelId } };
    },
    onSuccess: patchLabel,
    onRevert: patchLabel,
  });

  const properties = (
    <CardDetailProperties
      card={card}
      columnId={columnId}
      columns={columns}
      members={members}
      labels={labels}
      selectedAssigneeIds={assignees.value}
      selectedLabelId={label.value}
      dueValue={due.value}
      dueError={due.error}
      writeError={assignees.error ?? label.error}
      dueLate={
        card.dueDate != null &&
        cardDueLabel(
          { dueDate: card.dueDate, dueTimeZone: card.dueTimeZone ?? null },
          { viewerTimeZone },
        ).late
      }
      // Untouched, the moment keeps the zone it was set in; editing the time
      // makes it a new moment on the viewer's clock.
      dueHintTimeZone={
        due.value === dueInitial && card.dueTimeZone ? card.dueTimeZone : viewerTimeZone
      }
      canEdit={canEdit}
      askingDelete={askingDelete}
      onAskingDelete={onAskingDelete}
      onDueChange={(value) => due.setValue(value)}
      onDueBlur={() => void due.flush()}
      onToggleAssignee={(userId) => {
        const current = assigneeIdsRef.current;
        const next = current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId];
        patchAssignees(next);
        assignees.setValue(next);
      }}
      onPickLabel={(labelId) => {
        label.setValue(labelId);
        patchLabel(labelId);
      }}
      onMoveColumn={onMoveColumn}
      onArchive={onArchive}
      onDelete={onDelete}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col tablet:grid tablet:grid-cols-[minmax(0,1fr)_276px]">
      <div className="flex min-h-0 flex-1 flex-col tablet:overflow-auto">
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-4 py-[18px] tablet:flex-none tablet:overflow-visible tablet:px-[22px] tablet:py-[22px]">
          <CardDetailFields card={card} canEdit={canEdit} onCardPatch={onCardPatch} />
          <CardSubtaskList
            cardId={card.id}
            subtasks={subtasks}
            canEdit={canEdit}
            canCheck={canComment}
            onChange={(next) => onCardPatch({ subtasks: next })}
          />
          <div className="tablet:hidden">{properties}</div>
          <CardCommentThread comments={comments} />
        </div>
        {canComment ? (
          <div className="flex-none border-t border-border bg-surface px-4 py-[11px] pb-3.5 tablet:border-0 tablet:px-[22px] tablet:pt-0 tablet:pb-[22px]">
            <CardCommentComposer
              cardId={card.id}
              comments={comments}
              currentUser={currentUser}
              onChange={(next) => onCardPatch({ comments: next })}
            />
          </div>
        ) : null}
      </div>
      <aside className="hidden min-h-0 flex-col overflow-auto border-l border-border bg-background px-5 py-[22px] tablet:flex">
        {properties}
      </aside>
    </div>
  );
}

function CardDetailFields({
  card,
  canEdit,
  onCardPatch,
}: {
  card: BoardCardData;
  canEdit: boolean;
  onCardPatch: (patch: Partial<BoardCardData>) => void;
}) {
  const title = useProfileAutosave({
    initial: card.title,
    debounceMs: PROFILE_AUTOSAVE_DEBOUNCE_MS,
    save: (value) => updateCardField({ cardId: card.id, field: 'title', value }),
    onSuccess: (value) => onCardPatch({ title: value }),
    onRevert: (value) => onCardPatch({ title: value }),
  });
  const description = useProfileAutosave({
    initial: card.description ?? '',
    debounceMs: PROFILE_AUTOSAVE_DEBOUNCE_MS,
    save: (value) => updateCardField({ cardId: card.id, field: 'description', value }),
    onSuccess: (value) => onCardPatch({ description: value }),
    onRevert: (value) => onCardPatch({ description: value }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <EditableServiceText
          ariaLabel="Title"
          value={title.value}
          canEdit={canEdit}
          rows={2}
          onChange={(next) => {
            title.setValue(next);
            onCardPatch({ title: next });
          }}
          onBlur={() => void title.flush()}
          className={cn(
            shellFocusClassName,
            'w-full resize-none border-b border-transparent bg-transparent text-xl font-semibold tracking-[-0.02em] leading-[1.3]',
            'hover:border-border tablet:text-[19px]',
          )}
          displayClassName={cn(
            'w-full border-b border-transparent text-xl font-semibold tracking-[-0.02em] leading-[1.3]',
            'hover:border-border tablet:text-[19px]',
            canEdit && 'cursor-text',
          )}
        />
        {title.error ? (
          <p role="alert" className="text-sm text-destructive">
            {title.error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-[9px]">
        <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Description
        </span>
        <EditableServiceText
          ariaLabel="Description"
          value={description.value}
          canEdit={canEdit}
          rows={4}
          placeholder="Add context, acceptance criteria, or links"
          onChange={(next) => {
            description.setValue(next);
            onCardPatch({ description: next });
          }}
          onBlur={() => void description.flush()}
          className={cn(
            shellFocusClassName,
            'resize-none rounded-md border border-border bg-background px-[13px] py-[11px] text-sm leading-[1.6] tablet:text-[13.5px]',
          )}
          displayClassName={cn(
            'min-h-[6.4em] whitespace-pre-wrap rounded-md border border-border bg-background px-[13px] py-[11px] text-sm leading-[1.6] tablet:text-[13.5px]',
            canEdit && 'cursor-text',
          )}
        />
        {description.error ? (
          <p role="alert" className="text-sm text-destructive">
            {description.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CardDetailProperties({
  card,
  columnId,
  columns,
  members,
  labels,
  selectedAssigneeIds,
  selectedLabelId,
  dueValue,
  dueError,
  writeError,
  dueLate,
  dueHintTimeZone,
  canEdit,
  askingDelete,
  onAskingDelete,
  onDueChange,
  onDueBlur,
  onToggleAssignee,
  onPickLabel,
  onMoveColumn,
  onArchive,
  onDelete,
}: {
  card: BoardCardData;
  columnId: string;
  columns: Array<{ id: string; title: string }>;
  members: BoardMember[];
  labels: LabelView[];
  selectedAssigneeIds: string[];
  selectedLabelId: string | null;
  dueValue: string;
  dueError: string | null;
  writeError: string | null;
  dueLate: boolean;
  dueHintTimeZone: string | null;
  canEdit: boolean;
  askingDelete: boolean;
  onAskingDelete: (value: boolean) => void;
  onDueChange: (value: string) => void;
  onDueBlur: () => void;
  onToggleAssignee: (userId: string) => void;
  onPickLabel: (labelId: string | null) => void;
  onMoveColumn: (columnId: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const selectedAssignees = new Set(selectedAssigneeIds);

  return (
    <div className="flex h-full flex-col gap-5 rounded-[10px] border border-border bg-surface p-[15px] tablet:rounded-none tablet:border-0 tablet:bg-transparent tablet:p-0">
      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Column
        </span>
        <div className="grid grid-cols-2 gap-1.5 tablet:gap-[5px]">
          {columns.map((column) => {
            const selected = column.id === columnId;
            return (
              <button
                key={column.id}
                type="button"
                aria-pressed={selected}
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return;
                  onMoveColumn(column.id);
                }}
                className={cn(
                  shellFocusClassName,
                  'h-[38px] rounded-sm border text-[13px] font-medium tablet:h-8 tablet:text-[12.5px]',
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
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Assignees
        </span>
        <div className="flex flex-wrap gap-2 tablet:gap-1.5">
          {members.map((member) => {
            const selected = selectedAssignees.has(member.id);
            return (
              <button
                key={member.id}
                type="button"
                title={member.name}
                aria-label={member.name}
                aria-pressed={selected}
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return;
                  onToggleAssignee(member.id);
                }}
                className={cn(
                  shellFocusClassName,
                  'inline-flex size-[38px] shrink-0 items-center justify-center rounded-full border text-xs font-semibold tablet:size-8 tablet:text-[11px]',
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
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Label
        </span>
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => {
            const selected = selectedLabelId === label.id;
            const tone = labelToneClasses(label.tone);
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={selected}
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return;
                  onPickLabel(selected ? null : label.id);
                }}
                className={cn(
                  shellFocusClassName,
                  'rounded-full border px-[13px] py-[7px] text-[12.5px] font-medium tablet:px-[11px] tablet:py-[5px] tablet:text-[11.5px]',
                  selected ? tone.pill : 'border-border bg-transparent text-muted-foreground',
                )}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label
          htmlFor={`card-due-${card.id}-date`}
          className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase"
        >
          Due date
        </label>
        <DueDateField
          idPrefix={`card-due-${card.id}`}
          value={dueValue}
          onChange={onDueChange}
          onBlur={onDueBlur}
          canEdit={canEdit}
          error={dueError ?? undefined}
          late={dueLate}
          hintTimeZone={dueHintTimeZone}
        />
      </section>

      {writeError ? (
        <p role="alert" className="text-sm text-destructive">
          {writeError}
        </p>
      ) : null}

      {canEdit ? (
        <div className="mt-auto flex flex-col gap-1.5 border-t border-border pt-[18px]">
          {askingDelete ? (
            <div className="flex flex-col gap-[9px] rounded-md border border-danger-edge bg-danger-soft p-3">
              <p className="text-[12.5px] leading-[1.5] text-pretty">
                This deletes the task and its comments. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAskingDelete(false)}
                  className={cn(
                    shellFocusClassName,
                    'h-[30px] flex-1 rounded-sm border border-border-strong text-[12.5px] font-medium',
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className={cn(
                    shellFocusClassName,
                    'h-[30px] flex-1 rounded-sm bg-danger text-[12.5px] font-semibold text-primary-foreground',
                  )}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onArchive}
                className={cn(
                  shellFocusClassName,
                  'inline-flex h-[34px] items-center gap-2 rounded-md px-2.5 text-[13px] text-foreground hover:bg-card',
                )}
              >
                <Archive className="size-[15px]" strokeWidth={1.8} />
                Archive task
              </button>
              <button
                type="button"
                onClick={() => onAskingDelete(true)}
                className={cn(
                  shellFocusClassName,
                  'inline-flex h-[34px] items-center gap-2 rounded-md px-2.5 text-[13px] text-danger hover:bg-danger-soft',
                )}
              >
                <Trash2 className="size-[15px]" strokeWidth={1.8} />
                Delete task
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
