'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { createInvitation } from '@/actions/createInvitation';
import { leaveProject } from '@/actions/leaveProject';
import { transferOwnership } from '@/actions/transferOwnership';
import { updatePublicLink } from '@/actions/updatePublicLink';
import { useProfileAutosave } from '@/components/account/useProfileAutosave';
import BoardCheckRow from '@/components/projects/BoardCheckRow';
import ShareConfirm from '@/components/projects/ShareConfirm';
import type { ShareMember, ShareMemberRoleState } from '@/components/projects/boardTypes';
import ShareMemberRow from '@/components/projects/ShareMemberRow';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  LEAVE_PROJECT_LABEL,
  membershipsAfterOwnershipTransfer,
  publicBoardUrl,
  viewerProjectCapabilities,
  type MembershipRole,
} from '@/lib/boardAccess';
import type { BoardAccess } from '@/lib/membership';
import {
  CANT_INVITE_USER_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  LEAVE_PROJECT_DESCRIPTION,
  OWNER_MUST_TRANSFER_MESSAGE,
} from '@/lib/messages';
import { PROJECTS_PATH } from '@/lib/routes';
import { cn } from '@/lib/utils';

export default function ShareModalBody({
  projectId,
  members,
  currentUserId,
  canAdminister,
  publicLinkEnabled,
  shareUrl,
  copied,
  onCopied,
  onAccessChange,
  onRoleChange,
  onRemoved,
  onOwnershipChange,
  onPublicLinkChange,
}: {
  projectId: string;
  members: ShareMember[];
  currentUserId: string;
  canAdminister: boolean;
  publicLinkEnabled: boolean;
  shareUrl: string;
  copied: boolean;
  onCopied: () => void;
  onAccessChange: (membershipId: string, access: BoardAccess) => void;
  onRoleChange: (membershipId: string, next: ShareMemberRoleState) => void;
  onRemoved: (membershipId: string) => void;
  onOwnershipChange: (ownerMembershipId: string) => void;
  onPublicLinkChange: (enabled: boolean) => void;
}) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [transferConfirmId, setTransferConfirmId] = useState<string | null>(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leavePending, startLeave] = useTransition();

  const ownerMembershipId = members.find((member) => member.role === 'OWNER')?.membershipId ?? '';

  const ownership = useProfileAutosave({
    initial: ownerMembershipId,
    debounceMs: 0,
    resetKey: ownerMembershipId,
    save: async (membershipId) => {
      if (membershipId === ownerMembershipId) {
        return { data: { value: membershipId } };
      }
      const result = await transferOwnership({ projectId, membershipId });
      if ('error' in result) return result;
      return { data: { value: result.data.membershipId } };
    },
    onSuccess: (membershipId) => {
      setTransferConfirmId(null);
      onOwnershipChange(membershipId);
    },
    onRevert: () => {
      setTransferConfirmId(null);
    },
  });

  const displayedMembers = membershipsAfterOwnershipTransfer(members, ownership.value);
  const viewer = displayedMembers.find((member) => member.id === currentUserId);
  const viewerRole: MembershipRole = viewer?.role ?? 'MEMBER';
  const { canAdminister: viewerCanAdminister } = viewerProjectCapabilities(viewer, {
    role: canAdminister ? 'ADMIN' : 'MEMBER',
    access: 'VIEW',
  });
  const viewerIsOwner = viewerRole === 'OWNER';
  const transferPending = ownership.value !== ownerMembershipId;
  const canInvite = viewerCanAdminister && username.trim().length > 0 && !inviting;

  const publicLink = useProfileAutosave({
    initial: publicLinkEnabled,
    debounceMs: 0,
    save: async (enabled) => {
      const result = await updatePublicLink({ projectId, enabled });
      if ('error' in result) return result;
      return { data: { value: result.data.enabled } };
    },
    onSuccess: onPublicLinkChange,
    onRevert: onPublicLinkChange,
  });

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    const trimmed = username.trim();
    if (!viewerCanAdminister || !trimmed || inviting) return;
    setInviting(true);
    setInviteError(null);
    const result = await createInvitation({ projectId, username: trimmed });
    setInviting(false);
    if ('error' in result) {
      setInviteError(result.error === 'Unauthorized' ? result.error : CANT_INVITE_USER_MESSAGE);
      return;
    }
    setUsername('');
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      onCopied();
    } catch {
      onCopied();
    }
  }

  function onLeave() {
    setLeaveError(null);
    startLeave(async () => {
      const result = await leaveProject({ projectId });
      if ('error' in result) {
        setLeaveError(
          result.error === OWNER_MUST_TRANSFER_MESSAGE ? result.error : GENERIC_ERROR_MESSAGE,
        );
        return;
      }
      router.push(PROJECTS_PATH);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5 overflow-auto p-5">
      <form onSubmit={(event) => void onInvite(event)} className="flex gap-2">
        <input
          type="text"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setInviteError(null);
          }}
          placeholder="Username"
          autoComplete="off"
          disabled={!viewerCanAdminister}
          aria-label="Username"
          aria-invalid={Boolean(inviteError)}
          aria-describedby={inviteError ? 'share-invite-error' : undefined}
          className={cn(
            shellFocusClassName,
            'h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-[13px] text-sm text-foreground tablet:h-[38px] tablet:px-3 tablet:text-[13.5px]',
            'placeholder:text-subtle disabled:opacity-50',
          )}
        />
        <button
          type="submit"
          disabled={!canInvite}
          className={cn(
            shellFocusClassName,
            'h-11 shrink-0 rounded-md bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground tablet:h-[38px] tablet:text-[13px]',
            'disabled:opacity-45',
          )}
        >
          Invite
        </button>
      </form>
      {inviteError ? (
        <p id="share-invite-error" role="alert" className="-mt-3 text-sm text-destructive">
          {inviteError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          With access
        </span>
        <div className="flex flex-col">
          {displayedMembers.map((member) => (
            <ShareMemberRow
              key={member.membershipId}
              projectId={projectId}
              member={member}
              currentUserId={currentUserId}
              viewerRole={viewerRole}
              canAdminister={viewerCanAdminister}
              confirmingTransfer={transferConfirmId === member.membershipId}
              transferPending={transferPending}
              transferError={ownership.error}
              onAccessChange={onAccessChange}
              onRoleChange={onRoleChange}
              onRemoved={onRemoved}
              onRequestTransfer={setTransferConfirmId}
              onCancelTransfer={() => setTransferConfirmId(null)}
              onConfirmTransfer={(membershipId) => ownership.setValue(membershipId)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 tablet:gap-2.5">
        <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Link
        </span>
        <BoardCheckRow
          checked={publicLink.value}
          onToggle={() => {
            if (!viewerCanAdminister) return;
            const next = !publicLink.value;
            publicLink.setValue(next);
            onPublicLinkChange(next);
          }}
          className={cn(
            'gap-3 py-1.5 text-[13.5px] tablet:gap-[11px] tablet:py-0 tablet:text-[13px]',
            viewerCanAdminister ? '' : 'cursor-default opacity-70',
          )}
          boxClassName="size-5 rounded-md text-[11px] tablet:size-4 tablet:rounded-[5px] tablet:text-[9px]"
        >
          Anyone with the link can view the board
        </BoardCheckRow>
        <div className="flex gap-2">
          <span className="flex h-[42px] min-w-0 flex-1 items-center overflow-hidden rounded-md border border-border bg-background px-3 text-[12.5px] text-ellipsis whitespace-nowrap text-muted-foreground tablet:h-9">
            {shareUrl}
          </span>
          <button
            type="button"
            onClick={() => void onCopy()}
            className={cn(
              shellFocusClassName,
              'h-[42px] shrink-0 rounded-md border border-border bg-card px-[15px] text-[13px] font-medium tablet:h-9 tablet:px-3.5 tablet:text-[12.5px]',
              'hover:border-border-strong',
            )}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        {viewerIsOwner ? (
          <>
            <button
              type="button"
              disabled
              aria-describedby="share-leave-hint"
              className={cn(
                shellFocusClassName,
                'inline-flex h-[34px] items-center rounded-md px-2.5 text-left text-[13px] text-danger opacity-45',
              )}
            >
              {LEAVE_PROJECT_LABEL}
            </button>
            <p id="share-leave-hint" className="px-2.5 text-[12.5px] text-muted-foreground">
              {OWNER_MUST_TRANSFER_MESSAGE}
            </p>
          </>
        ) : leaveConfirm ? (
          <ShareConfirm
            description={LEAVE_PROJECT_DESCRIPTION}
            confirmLabel={LEAVE_PROJECT_LABEL}
            pendingLabel="Leaving..."
            pending={leavePending}
            error={leaveError}
            onCancel={() => {
              setLeaveConfirm(false);
              setLeaveError(null);
            }}
            onConfirm={onLeave}
          />
        ) : (
          <button
            type="button"
            onClick={() => setLeaveConfirm(true)}
            className={cn(
              shellFocusClassName,
              'inline-flex h-[34px] items-center rounded-md px-2.5 text-left text-[13px] text-danger hover:bg-danger-soft',
            )}
          >
            {LEAVE_PROJECT_LABEL}
          </button>
        )}
      </div>
    </div>
  );
}

export function shareUrlFromWindow(projectId: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return publicBoardUrl(origin, projectId);
}
