'use client';

import { LogOut, X } from 'lucide-react';
import Link from 'next/link';

import { useLiveShellUser } from '@/components/account/DisplayNameProvider';
import { useSignOut } from '@/components/account/useSignOut';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import { shellFocusClassName, type ProjectsShellUser } from '@/components/projects/shell';
import { accountPath, type AccountTab } from '@/lib/routes';
import { cn } from '@/lib/utils';

const ACCOUNT_LINKS: { tab: AccountTab; label: string }[] = [
  { tab: 'profile', label: 'Profile' },
  { tab: 'visibility', label: 'Visibility' },
  { tab: 'activity', label: 'Activity' },
];

const itemClassName = cn(
  shellFocusClassName,
  'flex items-center rounded-sm px-2.5 py-2 text-[13px] text-muted-foreground no-underline',
  'hover:bg-card hover:text-foreground',
);

export function AccountMenuContent({
  user,
  onClose,
}: {
  user: ProjectsShellUser;
  onClose?: () => void;
}) {
  const liveUser = useLiveShellUser(user);
  const { setOpenPanel } = useOpenPanel();
  const { signOut, error, isSigningOut } = useSignOut();

  function close() {
    setOpenPanel(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-1.5">
      <div className="flex items-center">
        <span className="mr-auto px-2.5 pt-2 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase">
          Account
        </span>
        {onClose ? (
          <button
            type="button"
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground md:hidden"
            onClick={onClose}
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-3">
        <span
          className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-xs font-semibold leading-none"
          aria-hidden="true"
        >
          {liveUser.initials}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13.5px] font-semibold">{liveUser.name}</span>
          <span className="text-xs text-muted-foreground">@{liveUser.username}</span>
        </span>
      </div>

      <nav className="flex flex-col gap-px border-t border-border pt-1.5" aria-label="Account">
        {ACCOUNT_LINKS.map((item) => (
          <Link
            key={item.tab}
            href={accountPath(item.tab)}
            className={itemClassName}
            onClick={close}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-1.5 border-t border-border pt-1.5">
        {error ? (
          <p role="alert" className="px-2.5 pb-1 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={isSigningOut}
          className={cn(
            shellFocusClassName,
            'flex w-full items-center gap-[9px] rounded-sm px-2.5 py-2 text-[13px] text-destructive',
            'hover:bg-destructive/14',
          )}
        >
          <LogOut className="size-[15px]" strokeWidth={1.7} />
          Sign out
        </button>
      </div>
    </div>
  );
}
