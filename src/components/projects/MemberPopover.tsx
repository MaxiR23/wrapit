import { useLayoutEffect, useRef, useState } from 'react';

import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';
import type { BoardMember } from '@/components/projects/boardTypes';
import { memberPopoverOffsetX } from '@/components/projects/memberPopoverPosition';
import { shellFocusClassName } from '@/components/projects/shell';

export default function MemberPopover({ members }: { members: BoardMember[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1">
      {members.map((member) => (
        <MemberAvatar
          key={member.id}
          member={member}
          open={openId === member.id}
          onToggle={() => setOpenId(openId === member.id ? null : member.id)}
          onClose={() => setOpenId(null)}
        />
      ))}
    </div>
  );
}

function MemberAvatar({
  member,
  open,
  onToggle,
  onClose,
}: {
  member: BoardMember;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const label = initials(member.name, member.username);
  const avatarClassName = cn(
    'inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border bg-muted text-[10.5px] font-semibold leading-none',
    open ? 'border-foreground' : 'border-border-strong',
  );

  useLayoutEffect(() => {
    if (!open) return;

    function update() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const avatar = trigger.getBoundingClientRect();
      const popover = panel.getBoundingClientRect();
      const left = memberPopoverOffsetX({
        avatarLeft: avatar.left,
        avatarWidth: avatar.width,
        popoverWidth: popover.width,
        viewportWidth: window.innerWidth,
      });
      panel.style.left = `${left}px`;
      panel.style.transform = 'none';
    }

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  return (
    <span className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={member.name}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
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
            className="fixed inset-0 z-40 cursor-default"
            onClick={onClose}
          />
          <div
            ref={panelRef}
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
}
