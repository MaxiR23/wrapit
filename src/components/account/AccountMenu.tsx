'use client';

import { useEffect, useRef } from 'react';

import { AccountMenuContent } from '@/components/account/AccountMenuContent';
import { useLiveShellUser } from '@/components/account/DisplayNameProvider';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import {
  shellFocusClassName,
  shellPanelClassName,
  type ProjectsShellUser,
} from '@/components/projects/shell';
import { cn } from '@/lib/utils';

export function AccountButton({
  user,
  showName = false,
  className,
  avatarClassName,
}: {
  user: ProjectsShellUser;
  showName?: boolean;
  className?: string;
  avatarClassName?: string;
}) {
  const liveUser = useLiveShellUser(user);
  const { openPanel, setOpenPanel } = useOpenPanel();
  const open = openPanel === 'account';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedByThis = useRef(false);

  useEffect(() => {
    if (openPanel === 'account') {
      openedByThis.current = document.activeElement === triggerRef.current;
      return;
    }
    if (!openedByThis.current) return;
    openedByThis.current = false;
    // Dismissal (account → null) restores focus. A switch to another panel
    // leaves focus on the control that opened it.
    if (openPanel === null) {
      triggerRef.current?.focus();
    }
  }, [openPanel]);

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label="Account"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={() => setOpenPanel(open ? null : 'account')}
      className={cn(shellFocusClassName, className)}
    >
      {showName ? (
        <span className="hidden flex-col items-end gap-px lg:flex">
          <span className="text-[13px] font-medium">{liveUser.name}</span>
          <span className="text-[11.5px] text-muted-foreground">{liveUser.username}</span>
        </span>
      ) : null}
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full border bg-card font-semibold leading-none',
          open ? 'border-foreground' : 'border-border-strong',
          avatarClassName,
        )}
      >
        {liveUser.initials}
      </span>
    </button>
  );
}

function AccountPanel({
  user,
  kind,
  onClose,
}: {
  user: ProjectsShellUser;
  kind: 'popover' | 'sheet';
  onClose?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal={kind === 'sheet' ? true : undefined}
      aria-label="Account"
      className={shellPanelClassName(kind, '236px')}
    >
      <AccountMenuContent user={user} onClose={onClose} />
    </div>
  );
}

export function AccountPopover({ user }: { user: ProjectsShellUser }) {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const open = openPanel === 'account';

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 hidden md:block"
        aria-hidden="true"
        onClick={() => setOpenPanel(null)}
      />
      <AccountPanel user={user} kind="popover" />
    </>
  );
}

export function AccountSheet({ user }: { user: ProjectsShellUser }) {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const open = openPanel === 'account';

  if (!open) return null;

  return <AccountPanel user={user} kind="sheet" onClose={() => setOpenPanel(null)} />;
}
