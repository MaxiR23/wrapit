'use client';

import { ChevronRight } from 'lucide-react';

import { useActiveStatus } from '@/components/account/ActiveStatusProvider';
import { useDisplayName } from '@/components/account/DisplayNameProvider';
import { userStatusToneClasses } from '@/lib/userStatus';
import { cn } from '@/lib/utils';

export default function UserStatusPreview({ username }: { username: string }) {
  const { name, initials } = useDisplayName('', username);
  const { status } = useActiveStatus();
  const tone = userStatusToneClasses(status.color);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-semibold text-foreground">How the team sees it</span>
      <div
        role="region"
        aria-label="How the team sees it"
        className="flex flex-col rounded-xl border border-border-strong bg-surface p-1.5 shadow-[0_20px_50px_oklch(0_0_0/0.45)]"
      >
        <span className="px-2.5 pt-2 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase">
          Account
        </span>
        <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-3">
          <span
            className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-xs font-semibold leading-none"
            aria-hidden="true"
          >
            {initials}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13.5px] font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">@{username}</span>
          </span>
        </div>
        <div className="flex items-center gap-[9px] border-y border-border px-2.5 py-[9px]">
          <span className={cn('size-2 shrink-0 rounded-full', tone.dot)} aria-hidden="true" />
          <span className="mr-auto text-[13px] text-foreground">{status.name}</span>
          <ChevronRight className="size-3.5 text-subtle" strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-px pt-1">
          <span className="px-2.5 py-2 text-[13px] text-muted-foreground">Profile</span>
          <span className="px-2.5 py-2 text-[13px] text-muted-foreground">Activity</span>
          <span className="px-2.5 py-2 text-[13px] text-muted-foreground">Cards</span>
        </div>
      </div>
      <p className="text-xs leading-normal text-subtle text-pretty">
        Status appears as a submenu in the account menu and next to your avatar on boards.
      </p>
    </div>
  );
}
