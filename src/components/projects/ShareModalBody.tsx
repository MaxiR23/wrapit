'use client';

import { useState, type FormEvent } from 'react';

import { createInvitation } from '@/actions/createInvitation';
import { updatePublicLink } from '@/actions/updatePublicLink';
import { useProfileAutosave } from '@/components/account/useProfileAutosave';
import BoardCheckRow from '@/components/projects/BoardCheckRow';
import type { ShareMember } from '@/components/projects/boardTypes';
import ShareMemberRow from '@/components/projects/ShareMemberRow';
import { shellFocusClassName } from '@/components/projects/shell';
import { publicBoardUrl } from '@/lib/boardAccess';
import type { BoardAccess } from '@/lib/membership';
import { CANT_INVITE_USER_MESSAGE } from '@/lib/messages';
import { cn } from '@/lib/utils';

export default function ShareModalBody({
  projectId,
  members,
  canAdminister,
  publicLinkEnabled,
  shareUrl,
  copied,
  onCopied,
  onAccessChange,
  onRemoved,
  onPublicLinkChange,
}: {
  projectId: string;
  members: ShareMember[];
  canAdminister: boolean;
  publicLinkEnabled: boolean;
  shareUrl: string;
  copied: boolean;
  onCopied: () => void;
  onAccessChange: (membershipId: string, access: BoardAccess) => void;
  onRemoved: (membershipId: string) => void;
  onPublicLinkChange: (enabled: boolean) => void;
}) {
  const [username, setUsername] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const canInvite = canAdminister && username.trim().length > 0 && !inviting;

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
    if (!canAdminister || !trimmed || inviting) return;
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
          disabled={!canAdminister}
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
          {members.map((member) => (
            <ShareMemberRow
              key={member.membershipId}
              projectId={projectId}
              member={member}
              canAdminister={canAdminister}
              onAccessChange={onAccessChange}
              onRemoved={onRemoved}
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
            if (!canAdminister) return;
            const next = !publicLink.value;
            publicLink.setValue(next);
            onPublicLinkChange(next);
          }}
          className={cn(
            'gap-3 py-1.5 text-[13.5px] tablet:gap-[11px] tablet:py-0 tablet:text-[13px]',
            canAdminister ? '' : 'cursor-default opacity-70',
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
    </div>
  );
}

export function shareUrlFromWindow(projectId: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return publicBoardUrl(origin, projectId);
}
