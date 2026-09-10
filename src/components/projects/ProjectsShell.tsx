import type { ReactNode } from 'react';

import { DisplayNameProvider } from '@/components/account/DisplayNameProvider';
import { NotificationsProvider } from '@/components/notifications/NotificationsProvider';
import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import ShellFrame from '@/components/projects/ShellFrame';
import type { ProjectsShellUser } from '@/components/projects/shell';
import type { NotificationListItem } from '@/lib/notifications';

export default function ProjectsShell({
  user,
  initialNotifications = [],
  openTaskCount = 0,
  children,
}: {
  user: ProjectsShellUser;
  initialNotifications?: NotificationListItem[];
  openTaskCount?: number;
  children: ReactNode;
}) {
  return (
    <DisplayNameProvider initialName={user.name} username={user.username}>
      <OpenPanelProvider>
        <NotificationsProvider initialItems={initialNotifications}>
          <ShellFrame user={user} openTaskCount={openTaskCount}>
            {children}
          </ShellFrame>
        </NotificationsProvider>
      </OpenPanelProvider>
    </DisplayNameProvider>
  );
}
