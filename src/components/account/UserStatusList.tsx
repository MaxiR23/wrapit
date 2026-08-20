'use client';

import { type FormEvent, useLayoutEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

import { createUserStatus } from '@/actions/createUserStatus';
import { setActiveStatus } from '@/actions/setActiveStatus';
import { useActiveStatus } from '@/components/account/ActiveStatusProvider';
import { profileInputClassName } from '@/components/account/ProfileFieldRow';
import { useProfileAutosave } from '@/components/account/useProfileAutosave';
import UserStatusRow from '@/components/account/UserStatusRow';
import { shellFocusClassName } from '@/components/projects/shell';
import { MAX_USER_STATUSES, type UserStatusTone, type UserStatusView } from '@/lib/userStatus';
import { cn } from '@/lib/utils';

export default function UserStatusList({ initialStatuses }: { initialStatuses: UserStatusView[] }) {
  const { status: active, setActive, getActive } = useActiveStatus();
  const [statuses, setStatuses] = useState(initialStatuses);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const canAdd = newName.trim().length > 0 && statuses.length < MAX_USER_STATUSES;
  const statusesRef = useRef(statuses);

  useLayoutEffect(() => {
    statusesRef.current = statuses;
  });

  function applyById(statusId: string) {
    const next = statusesRef.current.find((status) => status.id === statusId);
    if (!next) return;
    setActive({ id: next.id, name: next.name, color: next.color });
  }

  const selection = useProfileAutosave({
    initial: active.id,
    debounceMs: 0,
    save: (statusId) => setActiveStatus({ statusId }),
    onRevert: (statusId) => applyById(statusId),
  });

  function select(statusId: string) {
    const next = statuses.find((status) => status.id === statusId);
    if (!next) return;
    setActive({ id: next.id, name: next.name, color: next.color });
    selection.setValue(statusId);
  }

  function patchMeta(statusId: string, patch: { name?: string; color?: UserStatusTone }) {
    setStatuses((current) =>
      current.map((status) => (status.id === statusId ? { ...status, ...patch } : status)),
    );
  }

  function handleDeleted(result: { id: string; activeStatusId: string }) {
    setStatuses((current) => {
      const next = current.filter((status) => status.id !== result.id);
      const selected = next.find((status) => status.id === result.activeStatusId);
      if (selected && getActive().id === result.id) {
        setActive({ id: selected.id, name: selected.name, color: selected.color });
        selection.setValue(selected.id);
      }
      return next;
    });
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || statuses.length >= MAX_USER_STATUSES) return;
    setAddError(null);
    const result = await createUserStatus({ name });
    if ('fieldErrors' in result) {
      setAddError(result.fieldErrors.name ?? 'Name is required');
      return;
    }
    if ('error' in result) {
      setAddError(result.error);
      return;
    }
    setStatuses((current) => [...current, result.data]);
    setNewName('');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <h2 id="user-status-heading" className="mr-auto text-[13px] font-semibold text-foreground">
          How you appear
        </h2>
        <button
          type="button"
          title="Edit statuses"
          aria-label="Edit statuses"
          aria-pressed={editing}
          className={cn(
            shellFocusClassName,
            'inline-flex size-7 items-center justify-center rounded-sm',
            editing
              ? 'bg-card text-foreground'
              : 'bg-transparent text-muted-foreground hover:bg-card hover:text-foreground',
          )}
          onClick={() => setEditing((current) => !current)}
        >
          <Pencil className="size-3.5" strokeWidth={1.7} />
        </button>
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-surface">
        <div role="radiogroup" aria-labelledby="user-status-heading">
          {statuses.map((status) => (
            <UserStatusRow
              key={status.id}
              status={status}
              active={status.id === active.id}
              editing={editing}
              canDelete={statuses.length > 1}
              onSelect={select}
              onMetaChange={patchMeta}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
        <form
          className="flex items-center gap-2.5 px-4 py-3"
          onSubmit={(event) => void handleAdd(event)}
        >
          <input
            aria-label="Add a status"
            className={cn(profileInputClassName, 'min-w-0 flex-1')}
            value={newName}
            placeholder="Add a status"
            onChange={(event) => {
              setNewName(event.target.value);
              setAddError(null);
            }}
          />
          <button
            type="submit"
            disabled={!canAdd}
            className={cn(
              shellFocusClassName,
              'h-[34px] shrink-0 rounded-sm bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground',
              'hover:bg-primary/90 disabled:opacity-45 disabled:pointer-events-none',
            )}
          >
            Add
          </button>
        </form>
      </div>
      {addError ? (
        <p role="alert" className="text-xs text-destructive">
          {addError}
        </p>
      ) : null}
    </div>
  );
}
