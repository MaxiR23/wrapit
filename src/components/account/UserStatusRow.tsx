'use client';

import { X } from 'lucide-react';

import { updateUserStatusField } from '@/actions/updateUserStatusField';
import { deleteUserStatus } from '@/actions/deleteUserStatus';
import { useActiveStatus } from '@/components/account/ActiveStatusProvider';
import { profileInputClassName } from '@/components/account/ProfileFieldRow';
import {
  PROFILE_AUTOSAVE_DEBOUNCE_MS,
  useProfileAutosave,
} from '@/components/account/useProfileAutosave';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  nextUserStatusTone,
  parseUserStatusTone,
  userStatusToneClasses,
  type UserStatusTone,
  type UserStatusView,
} from '@/lib/userStatus';
import { cn } from '@/lib/utils';

export default function UserStatusRow({
  status,
  active,
  editing,
  canDelete,
  onSelect,
  onMetaChange,
  onDeleted,
}: {
  status: UserStatusView;
  active: boolean;
  editing: boolean;
  canDelete: boolean;
  onSelect: (statusId: string) => void;
  onMetaChange: (statusId: string, patch: { name?: string; color?: UserStatusTone }) => void;
  onDeleted: (result: { id: string; activeStatusId: string }) => void;
}) {
  const { getActive, setActive } = useActiveStatus();
  const toneKey = parseUserStatusTone(status.color);

  function applyIfStillActive(patch: { name?: string; color?: UserStatusTone }) {
    const current = getActive();
    if (current.id !== status.id) return;
    setActive({ ...current, ...patch });
  }

  function revertMeta(patch: { name?: string; color?: UserStatusTone }) {
    onMetaChange(status.id, patch);
    applyIfStillActive(patch);
  }

  const name = useProfileAutosave({
    initial: status.name,
    debounceMs: PROFILE_AUTOSAVE_DEBOUNCE_MS,
    save: (value) => updateUserStatusField({ statusId: status.id, field: 'name', value }),
    onSuccess: (value) => applyIfStillActive({ name: value }),
    onRevert: (value) => revertMeta({ name: value }),
  });
  const description = useProfileAutosave({
    initial: status.description,
    debounceMs: PROFILE_AUTOSAVE_DEBOUNCE_MS,
    save: (value) => updateUserStatusField({ statusId: status.id, field: 'description', value }),
  });
  const color = useProfileAutosave({
    initial: toneKey,
    debounceMs: 0,
    save: (value) => updateUserStatusField({ statusId: status.id, field: 'color', value }),
    onSuccess: (value) => applyIfStillActive({ color: value }),
    onRevert: (value) => revertMeta({ color: value }),
  });
  const classes = userStatusToneClasses(color.value);
  const editInputClassName = cn(profileInputClassName, 'h-8 px-2.5 text-[13px]');

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-border px-4 py-[13px]',
        active && 'bg-foreground/[0.03]',
      )}
    >
      <span className="relative inline-flex size-[17px] shrink-0 items-center justify-center">
        <input
          type="radio"
          name="user-status"
          value={status.id}
          checked={active}
          onChange={() => onSelect(status.id)}
          aria-label={name.value}
          className={cn(
            shellFocusClassName,
            'peer absolute inset-0 cursor-pointer appearance-none rounded-full border-[1.5px]',
            'border-border-strong checked:border-foreground',
          )}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none size-[9px] rounded-full bg-transparent peer-checked:bg-foreground"
        />
      </span>
      <span className={cn('size-[9px] shrink-0 rounded-full', classes.dot)} aria-hidden="true" />

      {editing ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input
            aria-label={`${name.value} name`}
            className={cn(editInputClassName, 'w-full sm:w-[170px]')}
            value={name.value}
            onChange={(event) => {
              const next = event.target.value;
              name.setValue(next);
              onMetaChange(status.id, { name: next });
              applyIfStillActive({ name: next });
            }}
            onBlur={() => void name.flush()}
          />
          <input
            aria-label={`${name.value} description`}
            className={cn(editInputClassName, 'min-w-0 flex-1 text-muted-foreground')}
            value={description.value}
            placeholder="Description"
            onChange={(event) => description.setValue(event.target.value)}
            onBlur={() => void description.flush()}
          />
          <button
            type="button"
            title="Change color"
            aria-label="Change color"
            className={cn(
              shellFocusClassName,
              'size-[26px] shrink-0 rounded-full border',
              classes.swatch,
            )}
            onClick={() => {
              const next = nextUserStatusTone(color.value);
              color.setValue(next);
              onMetaChange(status.id, { color: next });
              applyIfStillActive({ color: next });
            }}
          />
          <button
            type="button"
            title="Remove"
            aria-label={`Remove ${name.value}`}
            disabled={!canDelete}
            className={cn(
              shellFocusClassName,
              'inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground',
              'hover:bg-destructive/14 hover:text-destructive',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
            onClick={() => {
              void deleteUserStatus({ statusId: status.id }).then((result) => {
                if ('data' in result) onDeleted(result.data);
              });
            }}
          >
            <X className="size-3.5" strokeWidth={1.7} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(status.id)}
          className="mr-auto flex min-w-0 flex-col items-start gap-0.5 bg-transparent p-0 text-left"
        >
          <span className="text-[13.5px] font-medium text-foreground">{name.value}</span>
          {description.value ? (
            <span className="text-xs text-muted-foreground">{description.value}</span>
          ) : null}
        </button>
      )}

      {active ? <span className="shrink-0 text-[11.5px] text-subtle">Current</span> : null}

      {name.error || description.error || color.error ? (
        <p role="alert" className="sr-only">
          {name.error ?? description.error ?? color.error}
        </p>
      ) : null}
    </div>
  );
}
