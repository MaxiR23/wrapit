'use client';

import { AccountButton, AccountSheet } from '@/components/account/AccountMenu';
import { useLiveShellUser } from '@/components/account/DisplayNameProvider';
import {
  NotificationsBell,
  NotificationsSheet,
} from '@/components/notifications/NotificationsBell';
import ProjectsBrand from '@/components/projects/ProjectsBrand';
import { type ProjectsShellUser } from '@/components/projects/shell';

export default function ProjectsMobileHeader({
  user,
  title = 'Projects',
}: {
  user: ProjectsShellUser;
  title?: string;
}) {
  const liveUser = useLiveShellUser(user);

  return (
    <header className="flex h-mobile-header shrink-0 items-center gap-2.5 border-b border-border bg-surface px-4 tablet:hidden">
      <ProjectsBrand showName={false} />
      <span className="mr-auto text-base font-semibold tracking-[-0.01em]">{title}</span>
      <NotificationsBell
        className="size-11 text-muted-foreground hover:text-foreground"
        iconClassName="size-5"
        iconStrokeWidth={1.6}
      />
      <NotificationsSheet />
      <AccountButton user={liveUser} avatarClassName="size-9 text-xs" />
      <AccountSheet user={liveUser} />
    </header>
  );
}
