import { useState } from 'react';

import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';
import type { BoardMember } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';

export default function MemberPopover({
  members,
  interactive,
}: {
  members: BoardMember[];
  interactive: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5">
      {members.map((member) => {
        const open = openId === member.id;
        const label = initials(member.name, member.username);
        const avatarClassName = cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold leading-none',
          open ? 'border-foreground' : 'border-border-strong',
        );

        if (!interactive) {
          return (
            <span key={member.id} title={member.name} className={avatarClassName}>
              {label}
            </span>
          );
        }

        return (
          <span key={member.id} className="relative">
            <button
              type="button"
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label={member.name}
              onClick={(event) => {
                event.stopPropagation();
                setOpenId(open ? null : member.id);
              }}
              className={cn(shellFocusClassName, avatarClassName)}
            >
              {label}
            </button>
            {open ? (
              <>
                <button
                  type="button"
                  aria-label="Close member"
                  className="fixed inset-0 z-40 hidden cursor-default md:block"
                  onClick={() => setOpenId(null)}
                />
                <div
                  role="dialog"
                  aria-label={member.name}
                  className="absolute top-[calc(100%+8px)] left-1/2 z-50 min-w-[170px] -translate-x-1/2 rounded-[10px] border border-border-strong bg-surface p-3 shadow-[0_16px_40px_oklch(0_0_0/0.55)]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-[11px] font-semibold leading-none">
                      {label}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[13px] font-semibold">{member.name}</span>
                      <span className="text-xs text-muted-foreground">@{member.username}</span>
                    </span>
                  </div>
                </div>
              </>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
