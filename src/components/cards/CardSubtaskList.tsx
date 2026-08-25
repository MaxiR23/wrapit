'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { createSubtask } from '@/actions/createSubtask';
import { deleteSubtask } from '@/actions/deleteSubtask';
import { updateSubtaskField } from '@/actions/updateSubtaskField';
import {
  PROFILE_AUTOSAVE_DEBOUNCE_MS,
  useProfileAutosave,
} from '@/components/account/useProfileAutosave';
import { shellFocusClassName } from '@/components/projects/shell';
import type { BoardSubtask } from '@/components/projects/boardTypes';
import { subtaskProgress } from '@/lib/cardCounters';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { cn } from '@/lib/utils';

export default function CardSubtaskList({
  cardId,
  subtasks,
  onChange,
}: {
  cardId: string;
  subtasks: BoardSubtask[];
  onChange: (subtasks: BoardSubtask[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const subtasksRef = useRef(subtasks);
  useLayoutEffect(() => {
    subtasksRef.current = subtasks;
  });
  const { done, total } = subtaskProgress(subtasks);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  function patchSubtask(subtaskId: string, patch: Partial<BoardSubtask>) {
    onChange(
      subtasksRef.current.map((item) => (item.id === subtaskId ? { ...item, ...patch } : item)),
    );
  }

  async function handleAdd() {
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    setError(null);
    const result = await createSubtask({ cardId, text });
    setAdding(false);
    if ('fieldErrors' in result) {
      setError(result.fieldErrors.text ?? GENERIC_ERROR_MESSAGE);
      return;
    }
    if ('error' in result) {
      setError(GENERIC_ERROR_MESSAGE);
      return;
    }
    setDraft('');
    onChange([...subtasksRef.current, result.data]);
  }

  async function handleRemove(subtask: BoardSubtask) {
    onChange(subtasksRef.current.filter((item) => item.id !== subtask.id));
    const result = await deleteSubtask({ subtaskId: subtask.id });
    if ('error' in result) {
      const current = subtasksRef.current;
      if (!current.some((item) => item.id === subtask.id)) {
        const next = [...current, subtask];
        next.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
        onChange(next);
      }
      setError(GENERIC_ERROR_MESSAGE);
    }
  }

  return (
    <div className="flex flex-col gap-[11px]">
      <div className="flex items-center gap-2.5">
        <span className="mr-auto text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Subtasks
        </span>
        <span className="block h-1 w-[70px] overflow-hidden rounded-full bg-muted tablet:w-[88px]">
          <span
            className="block h-full rounded-full bg-status-in-progress"
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done}/{total}
        </span>
      </div>

      <div className="flex flex-col">
        {subtasks.map((subtask) => (
          <SubtaskRow
            key={subtask.id}
            subtask={subtask}
            onDone={(done) => patchSubtask(subtask.id, { done })}
            onRename={(text) => patchSubtask(subtask.id, { text })}
            onRemove={() => void handleRemove(subtask)}
          />
        ))}
        {subtasks.length === 0 ? (
          <span className="px-0.5 py-2.5 text-[13px] text-subtle">No subtasks</span>
        ) : null}
      </div>

      <input
        aria-label="Add a subtask"
        placeholder="Add a subtask"
        value={draft}
        disabled={adding}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void handleAdd();
          }
        }}
        onBlur={() => void handleAdd()}
        className={cn(
          shellFocusClassName,
          'h-9 rounded-md border border-transparent bg-transparent px-0.5 text-sm text-foreground',
          'placeholder:text-subtle hover:border-border tablet:text-[13.5px]',
        )}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SubtaskRow({
  subtask,
  onDone,
  onRename,
  onRemove,
}: {
  subtask: BoardSubtask;
  onDone: (done: boolean) => void;
  onRename: (text: string) => void;
  onRemove: () => void;
}) {
  const text = useProfileAutosave({
    initial: subtask.text,
    debounceMs: PROFILE_AUTOSAVE_DEBOUNCE_MS,
    save: (value) => updateSubtaskField({ subtaskId: subtask.id, field: 'text', value }),
    onSuccess: onRename,
    onRevert: onRename,
  });
  const done = useProfileAutosave({
    initial: subtask.done,
    debounceMs: 0,
    save: (value) => updateSubtaskField({ subtaskId: subtask.id, field: 'done', value }),
    onSuccess: onDone,
    onRevert: onDone,
  });

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 tablet:gap-[11px] tablet:py-[9px]">
      <input
        type="checkbox"
        checked={done.value}
        onChange={() => {
          const next = !done.value;
          done.setValue(next);
          onDone(next);
        }}
        aria-label={subtask.text}
        className={cn(
          shellFocusClassName,
          'size-5 shrink-0 rounded-[6px] border-[1.5px] border-border-strong accent-foreground tablet:size-[17px] tablet:rounded-[5px]',
        )}
      />
      <input
        aria-label="Subtask text"
        value={text.value}
        onChange={(event) => {
          const next = event.target.value;
          text.setValue(next);
          onRename(next);
        }}
        onBlur={() => void text.flush()}
        className={cn(
          shellFocusClassName,
          'min-w-0 flex-1 bg-transparent text-sm tablet:text-[13.5px]',
          subtask.done ? 'text-subtle line-through' : 'text-foreground',
        )}
      />
      <button
        type="button"
        aria-label={`Remove ${subtask.text}`}
        onClick={onRemove}
        className={cn(
          shellFocusClassName,
          'inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-danger-soft hover:text-danger',
        )}
      >
        <X className="size-3.5" strokeWidth={1.8} />
      </button>
      {text.error ? (
        <span role="alert" className="sr-only">
          {text.error}
        </span>
      ) : null}
    </div>
  );
}
