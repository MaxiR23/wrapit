'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { removeMember } from '@/actions/removeMember';
import { updateMembershipAccess } from '@/actions/updateMembershipAccess';
import { useProfileAutosave } from '@/components/account/useProfileAutosave';
import type { ShareMember } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { initials } from '@/lib/initials';
import {
  BOARD_ACCESS_OPTIONS,
  REMOVE_ACCESS_LABEL,
  shareMemberControlLabel,
  type ShareAccessValue,
} from '@/lib/boardAccess';
import type { BoardAccess } from '@/lib/membership';
import { cn } from '@/lib/utils';

export default function ShareMemberRow({
  projectId,
  member,
  canAdminister,
  onAccessChange,
  onRemoved,
}: {
  projectId: string;
  member: ShareMember;
  canAdminister: boolean;
  onAccessChange: (membershipId: string, access: BoardAccess) => void;
  onRemoved: (membershipId: string) => void;
}) {
  const isOwner = member.role === 'OWNER';
  const canChangeAccess = canAdminister && member.role === 'MEMBER';
  const canRemove = canAdminister && !isOwner;
  const showMenu = canChangeAccess || canRemove;
  const label = shareMemberControlLabel({ role: member.role, access: member.access });

  const persist = useProfileAutosave<ShareAccessValue>({
    initial: member.access,
    debounceMs: 0,
    save: async (value) => {
      if (value === 'REMOVED') {
        const result = await removeMember({
          projectId,
          membershipId: member.membershipId,
        });
        if ('error' in result) return result;
        return { data: { value: 'REMOVED' as const } };
      }
      const result = await updateMembershipAccess({
        projectId,
        membershipId: member.membershipId,
        access: value,
      });
      if ('error' in result) return result;
      return { data: { value: result.data.access } };
    },
    onSuccess: (value) => {
      if (value === 'REMOVED') {
        onRemoved(member.membershipId);
        return;
      }
      onAccessChange(member.membershipId, value);
    },
    onRevert: (value) => {
      if (value === 'REMOVED') return;
      onAccessChange(member.membershipId, value);
    },
  });

  if (persist.value === 'REMOVED') return null;

  const accessValue = persist.value;

  return (
    <div className="flex items-center gap-[11px] border-b border-border py-2.5 tablet:py-[9px]">
      <span
        aria-hidden="true"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-xs font-semibold leading-none tablet:size-8 tablet:text-[11px]"
      >
        {initials(member.name, member.username)}
      </span>
      <div className="mr-auto min-w-0">
        <span className="block truncate text-sm font-medium tablet:text-[13.5px]">
          {member.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">@{member.username}</span>
      </div>
      {showMenu ? (
        <ShareAccessMenu
          label={
            accessValue === member.access
              ? label
              : shareMemberControlLabel({ role: member.role, access: accessValue })
          }
          access={accessValue}
          canChangeAccess={canChangeAccess}
          canRemove={canRemove}
          error={persist.error}
          onPickAccess={(access) => persist.setValue(access)}
          onRemove={() => persist.setValue('REMOVED')}
        />
      ) : (
        <span
          className={cn(
            'inline-flex h-[34px] items-center px-[11px] text-[12.5px] tablet:h-[30px] tablet:px-2.5',
            isOwner ? 'text-subtle' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function ShareAccessMenu({
  label,
  access,
  canChangeAccess,
  canRemove,
  error,
  onPickAccess,
  onRemove,
}: {
  label: string;
  access: BoardAccess;
  canChangeAccess: boolean;
  canRemove: boolean;
  error: string | null;
  onPickAccess: (access: BoardAccess) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Change permission"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          shellFocusClassName,
          'inline-flex h-[34px] items-center gap-1.5 rounded-sm border border-border px-[11px] text-[12.5px] text-muted-foreground',
          'hover:border-border-strong hover:text-foreground tablet:h-[30px] tablet:px-2.5',
        )}
      >
        {label}
        <ChevronDown className="size-3" strokeWidth={2} />
      </button>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 min-w-[160px] rounded-[10px] border border-border-strong bg-surface p-1 shadow-[0_16px_40px_oklch(0_0_0/0.55)]"
        >
          {canChangeAccess
            ? BOARD_ACCESS_OPTIONS.map((option) => (
                <li key={option.value} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={access === option.value}
                    onClick={() => {
                      setOpen(false);
                      onPickAccess(option.value);
                    }}
                    className={cn(
                      shellFocusClassName,
                      'flex w-full rounded-sm px-2.5 py-1.5 text-left text-[13px] hover:bg-card',
                      access === option.value ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            : null}
          {canRemove ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onRemove();
                }}
                className={cn(
                  shellFocusClassName,
                  'flex w-full rounded-sm px-2.5 py-1.5 text-left text-[13px] text-danger hover:bg-danger-soft',
                )}
              >
                {REMOVE_ACCESS_LABEL}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </div>
  );
}
