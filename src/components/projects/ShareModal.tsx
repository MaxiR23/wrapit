'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import type { ShareMember, ShareMemberRoleState } from '@/components/projects/boardTypes';
import ShareModalBody, { shareUrlFromWindow } from '@/components/projects/ShareModalBody';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BoardAccess } from '@/lib/membership';
import { cn } from '@/lib/utils';

export default function ShareModal({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  members,
  currentUserId,
  canAdminister,
  publicLinkEnabled,
  onAccessChange,
  onRoleChange,
  onRemoved,
  onOwnershipChange,
  onPublicLinkChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  members: ShareMember[];
  currentUserId: string;
  canAdminister: boolean;
  publicLinkEnabled: boolean;
  onAccessChange: (membershipId: string, access: BoardAccess) => void;
  onRoleChange: (membershipId: string, next: ShareMemberRoleState) => void;
  onRemoved: (membershipId: string) => void;
  onOwnershipChange: (ownerMembershipId: string) => void;
  onPublicLinkChange: (enabled: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = shareUrlFromWindow(projectId);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCopied(false);
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-modal="true"
        overlayClassName="z-[85] bg-black/62"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'z-[85] flex flex-col gap-0 overflow-hidden border bg-surface p-0 text-foreground',
          'top-auto right-0 bottom-0 left-0 h-auto max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0',
          'rounded-t-[22px] rounded-b-none border-x-0 border-b-0 border-t border-border-strong',
          'shadow-[0_-22px_60px_oklch(0_0_0/0.6)] sm:max-w-none',
          'tablet:top-1/2 tablet:right-auto tablet:bottom-auto tablet:left-1/2 tablet:max-h-full tablet:w-full tablet:max-w-[520px]',
          'tablet:-translate-x-1/2 tablet:-translate-y-1/2 tablet:rounded-[14px] tablet:border tablet:border-border-strong',
          'tablet:shadow-[0_30px_70px_oklch(0_0_0/0.6)] tablet:sm:max-w-[520px]',
        )}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-[18px]">
          <div className="mr-auto flex min-w-0 flex-col gap-[3px]">
            <DialogTitle className="text-base font-semibold tracking-[-0.01em]">
              Share board
            </DialogTitle>
            <DialogDescription className="truncate text-[12.5px] text-muted-foreground">
              {projectTitle}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className={cn(
                shellFocusClassName,
                'inline-flex size-[30px] items-center justify-center rounded-sm text-muted-foreground hover:bg-card hover:text-foreground',
              )}
            >
              <X className="size-4" strokeWidth={1.8} />
            </button>
          </DialogClose>
        </div>
        <ShareModalBody
          projectId={projectId}
          members={members}
          currentUserId={currentUserId}
          canAdminister={canAdminister}
          publicLinkEnabled={publicLinkEnabled}
          shareUrl={shareUrl}
          copied={copied}
          onCopied={() => setCopied(true)}
          onAccessChange={onAccessChange}
          onRoleChange={onRoleChange}
          onRemoved={onRemoved}
          onOwnershipChange={onOwnershipChange}
          onPublicLinkChange={onPublicLinkChange}
        />
      </DialogContent>
    </Dialog>
  );
}
