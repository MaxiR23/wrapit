'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';

import { removeMember } from '@/actions/removeMember';
import { updateMembershipAccess } from '@/actions/updateMembershipAccess';
import { updateMembershipRole } from '@/actions/updateMembershipRole';
import { useProfileAutosave } from '@/components/account/useProfileAutosave';
import ShareConfirm from '@/components/projects/ShareConfirm';
import type { ShareMember, ShareMemberRoleState } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { initials } from '@/lib/initials';
import {
  BOARD_ACCESS_OPTIONS,
  MAKE_ADMIN_LABEL,
  REMOVE_ACCESS_LABEL,
  REMOVE_ADMIN_LABEL,
  TRANSFER_OWNERSHIP_LABEL,
  shareMemberControlLabel,
  type MembershipRole,
  type ShareAccessValue,
} from '@/lib/boardAccess';
import type { BoardAccess } from '@/lib/membership';
import {
  GENERIC_ERROR_MESSAGE,
  MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE,
  REMOVE_ADMIN_SELF_DESCRIPTION,
  TRANSFER_OWNERSHIP_DESCRIPTION,
} from '@/lib/messages';
import { cn } from '@/lib/utils';

export default function ShareMemberRow({
  projectId,
  member,
  currentUserId,
  viewerRole,
  canAdminister,
  confirmingTransfer,
  transferPending,
  transferError,
  onAccessChange,
  onRoleChange,
  onRemoved,
  onRequestTransfer,
  onCancelTransfer,
  onConfirmTransfer,
}: {
  projectId: string;
  member: ShareMember;
  currentUserId: string;
  viewerRole: MembershipRole;
  canAdminister: boolean;
  confirmingTransfer: boolean;
  transferPending: boolean;
  transferError: string | null;
  onAccessChange: (membershipId: string, access: BoardAccess) => void;
  onRoleChange: (membershipId: string, next: ShareMemberRoleState) => void;
  onRemoved: (membershipId: string) => void;
  onRequestTransfer: (membershipId: string) => void;
  onCancelTransfer: () => void;
  onConfirmTransfer: (membershipId: string) => void;
}) {
  const isOwner = member.role === 'OWNER';
  const isSelf = member.id === currentUserId;
  const canChangeAccess = canAdminister && member.role === 'MEMBER';
  const canChangeRole =
    canAdminister && !isOwner && (member.role === 'MEMBER' || member.role === 'ADMIN');
  const canRemove = canAdminister && !isOwner && !isSelf;
  const canTransfer = viewerRole === 'OWNER' && !isSelf && !isOwner;
  const showMenu = canChangeAccess || canChangeRole || canRemove || canTransfer;
  const label = shareMemberControlLabel({ role: member.role, access: member.access });

  const [confirmingDemote, setConfirmingDemote] = useState(false);
  const [demoteError, setDemoteError] = useState<string | null>(null);
  const [demotePending, startDemote] = useTransition();

  const persist = useProfileAutosave<ShareAccessValue>({
    initial: member.access,
    debounceMs: 0,
    resetKey: `${member.membershipId}:${member.role}:${member.access}`,
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

  function applyRoleResult(
    requested: 'ADMIN' | 'MEMBER',
    result:
      | { data: { role: 'ADMIN' | 'MEMBER'; access: BoardAccess } }
      | { error: string; current?: ShareMemberRoleState },
  ) {
    if ('error' in result) {
      if (result.error === MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE) {
        setConfirmingDemote(false);
        if (result.current) {
          onRoleChange(member.membershipId, result.current);
        }
        setDemoteError(result.current?.role === requested ? null : result.error);
        return;
      }
      setDemoteError(result.error === 'Unauthorized' ? result.error : GENERIC_ERROR_MESSAGE);
      return;
    }
    setConfirmingDemote(false);
    setDemoteError(null);
    onRoleChange(member.membershipId, result.data);
  }

  function onMakeAdmin() {
    startDemote(async () => {
      const result = await updateMembershipRole({
        projectId,
        membershipId: member.membershipId,
        role: 'ADMIN',
      });
      applyRoleResult('ADMIN', result);
    });
  }

  function onRemoveAdmin() {
    if (isSelf) {
      setDemoteError(null);
      setConfirmingDemote(true);
      return;
    }
    startDemote(async () => {
      const result = await updateMembershipRole({
        projectId,
        membershipId: member.membershipId,
        role: 'MEMBER',
      });
      applyRoleResult('MEMBER', result);
    });
  }

  function onConfirmDemote() {
    setDemoteError(null);
    startDemote(async () => {
      const result = await updateMembershipRole({
        projectId,
        membershipId: member.membershipId,
        role: 'MEMBER',
      });
      applyRoleResult('MEMBER', result);
    });
  }

  return (
    <div className="flex flex-col border-b border-border">
      <div className="flex items-center gap-[11px] py-2.5 tablet:py-[9px]">
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
            memberRole={member.role}
            canChangeAccess={canChangeAccess}
            canChangeRole={canChangeRole}
            canTransfer={canTransfer}
            canRemove={canRemove}
            error={persist.error}
            onPickAccess={(access) => persist.setValue(access)}
            onMakeAdmin={onMakeAdmin}
            onRemoveAdmin={onRemoveAdmin}
            onTransfer={() => onRequestTransfer(member.membershipId)}
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
      {confirmingTransfer ? (
        <div className="pb-2.5">
          <ShareConfirm
            title={TRANSFER_OWNERSHIP_LABEL}
            description={TRANSFER_OWNERSHIP_DESCRIPTION}
            confirmLabel={TRANSFER_OWNERSHIP_LABEL}
            pendingLabel="Transferring..."
            pending={transferPending}
            error={transferError}
            onCancel={onCancelTransfer}
            onConfirm={() => onConfirmTransfer(member.membershipId)}
          />
        </div>
      ) : null}
      {confirmingDemote ? (
        <div className="pb-2.5">
          <ShareConfirm
            title={REMOVE_ADMIN_LABEL}
            description={REMOVE_ADMIN_SELF_DESCRIPTION}
            confirmLabel={REMOVE_ADMIN_LABEL}
            pendingLabel="Saving..."
            pending={demotePending}
            error={demoteError}
            onCancel={() => {
              setConfirmingDemote(false);
              setDemoteError(null);
            }}
            onConfirm={onConfirmDemote}
          />
        </div>
      ) : demoteError ? (
        <p role="alert" className="pb-2.5 text-sm text-destructive">
          {demoteError}
        </p>
      ) : null}
    </div>
  );
}

function ShareAccessMenu({
  label,
  access,
  memberRole,
  canChangeAccess,
  canChangeRole,
  canTransfer,
  canRemove,
  error,
  onPickAccess,
  onMakeAdmin,
  onRemoveAdmin,
  onTransfer,
  onRemove,
}: {
  label: string;
  access: BoardAccess;
  memberRole: MembershipRole;
  canChangeAccess: boolean;
  canChangeRole: boolean;
  canTransfer: boolean;
  canRemove: boolean;
  error: string | null;
  onPickAccess: (access: BoardAccess) => void;
  onMakeAdmin: () => void;
  onRemoveAdmin: () => void;
  onTransfer: () => void;
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
          {canChangeRole && memberRole === 'MEMBER' ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onMakeAdmin();
                }}
                className={cn(
                  shellFocusClassName,
                  'flex w-full rounded-sm px-2.5 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-card',
                )}
              >
                {MAKE_ADMIN_LABEL}
              </button>
            </li>
          ) : null}
          {canChangeRole && memberRole === 'ADMIN' ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onRemoveAdmin();
                }}
                className={cn(
                  shellFocusClassName,
                  'flex w-full rounded-sm px-2.5 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-card',
                )}
              >
                {REMOVE_ADMIN_LABEL}
              </button>
            </li>
          ) : null}
          {canTransfer ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onTransfer();
                }}
                className={cn(
                  shellFocusClassName,
                  'flex w-full rounded-sm px-2.5 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-card',
                )}
              >
                {TRANSFER_OWNERSHIP_LABEL}
              </button>
            </li>
          ) : null}
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
