import { useLayoutEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';

import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';
import type { BoardMember } from '@/components/projects/boardTypes';
import { memberPopoverOffsetX } from '@/components/projects/memberPopoverPosition';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import { shellFocusClassName } from '@/components/projects/shell';

/** Desktop avatars shown in the header; the rest open from overflow. */
export const BOARD_VISIBLE_MEMBER_AVATARS = 3;

export default function MemberPopover({ members }: { members: BoardMember[] }) {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const [openId, setOpenId] = useState<string | null>(null);
  const openMemberId = openPanel === 'member' ? openId : null;
  const listOpen = openPanel === 'members';
  const visibleMembers = members.slice(0, BOARD_VISIBLE_MEMBER_AVATARS);
  const overflow = members.length - visibleMembers.length;

  function toggle(id: string) {
    if (openMemberId === id) {
      setOpenId(null);
      setOpenPanel(null);
      return;
    }
    setOpenId(id);
    setOpenPanel('member');
  }

  function close() {
    setOpenId(null);
    if (openPanel === 'member') setOpenPanel(null);
  }

  function toggleList() {
    setOpenId(null);
    setOpenPanel(listOpen ? null : 'members');
  }

  return (
    <div className="relative flex shrink-0 items-center">
      <div className="lg:hidden">
        <button
          type="button"
          aria-label="Members"
          aria-expanded={listOpen}
          aria-haspopup="dialog"
          title="Members"
          onClick={toggleList}
          className={cn(
            shellFocusClassName,
            'inline-flex items-center justify-center rounded-md border',
            'size-10',
            listOpen
              ? 'border-border-strong bg-card text-foreground'
              : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
          )}
        >
          <Users className="size-[17px]" strokeWidth={1.9} />
        </button>
      </div>
      <div className="hidden items-center gap-1 lg:flex">
        {visibleMembers.map((member) => (
          <MemberAvatar
            key={member.id}
            member={member}
            open={openMemberId === member.id}
            onToggle={() => toggle(member.id)}
            onClose={close}
          />
        ))}
        {overflow > 0 ? (
          <button
            type="button"
            aria-label={`${overflow} more members`}
            aria-expanded={listOpen}
            aria-haspopup="dialog"
            onClick={toggleList}
            className={cn(
              shellFocusClassName,
              'inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border bg-muted text-[10.5px] font-semibold leading-none',
              listOpen
                ? 'border-foreground text-foreground'
                : 'border-border-strong text-muted-foreground hover:border-foreground hover:text-foreground',
            )}
          >
            +{overflow}
          </button>
        ) : null}
      </div>
      {listOpen ? (
        <>
          <button
            type="button"
            aria-label="Close members"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpenPanel(null)}
          />
          <div
            role="dialog"
            aria-label="Members"
            className="absolute top-[calc(100%+8px)] left-0 z-50 w-[220px] rounded-xl border border-border-strong bg-surface p-3 shadow-[0_16px_40px_oklch(0_0_0/0.55)]"
          >
            <ul className="flex max-h-[240px] flex-col gap-3 overflow-y-auto">
              {members.map((member) => (
                <li key={member.id} className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-[11px] font-semibold leading-none">
                    {initials(member.name, member.username)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold">{member.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      @{member.username}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
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
            className="absolute top-[calc(100%+8px)] left-1/2 z-50 min-w-[170px] -translate-x-1/2 rounded-xl border border-border-strong bg-surface p-3 shadow-[0_16px_40px_oklch(0_0_0/0.55)]"
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
