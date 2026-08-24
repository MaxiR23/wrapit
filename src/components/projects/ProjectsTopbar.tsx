'use client';

import { AccountButton, AccountPopover } from '@/components/account/AccountMenu';
import { useLiveShellUser } from '@/components/account/DisplayNameProvider';
import {
  NotificationsBell,
  NotificationsPopover,
} from '@/components/notifications/NotificationsBell';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { shellFocusClassName, type ProjectsShellUser } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

export default function ProjectsTopbar({
  user,
  showSearch = true,
}: {
  user: ProjectsShellUser;
  showSearch?: boolean;
}) {
  const { query, setQuery } = useProjectsSearch();
  const topbarUser = useLiveShellUser(user);

  return (
    <header
      className={cn(
        'hidden shrink-0 items-center border-b border-border tablet:flex',
        'h-[60px] gap-3 px-5 lg:h-topbar lg:gap-3.5 lg:px-7',
      )}
    >
      {showSearch ? (
        <div className="relative mr-auto flex items-center">
          <input
            type="search"
            placeholder="Search projects"
            aria-label="Search projects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cn(
              shellFocusClassName,
              'rounded-md border border-input bg-surface text-foreground placeholder:text-subtle',
              'h-[38px] w-[240px] px-3.5 text-sm lg:h-9 lg:w-[300px] lg:pr-16 lg:text-[13.5px]',
            )}
          />
          <kbd className="pointer-events-none absolute right-2.5 hidden rounded-[5px] border border-border px-1.5 py-0.5 text-[11px] text-subtle lg:inline">
            ⌘K
          </kbd>
        </div>
      ) : (
        <div className="mr-auto" />
      )}

      <div className="relative">
        <NotificationsBell
          className="size-10 rounded-md border border-border text-muted-foreground hover:border-border-strong hover:text-foreground lg:size-9"
          iconClassName="size-[18px] lg:size-[17px]"
          iconStrokeWidth={1.8}
        />
        <NotificationsPopover />
      </div>

      <div className="relative">
        <AccountButton
          user={topbarUser}
          showName
          className="flex items-center gap-2.5 border-l border-border pl-3.5"
          avatarClassName="size-8 text-[11.5px]"
        />
        <AccountPopover user={topbarUser} />
      </div>
    </header>
  );
}
