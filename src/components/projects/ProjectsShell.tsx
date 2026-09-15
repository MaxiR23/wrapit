import type { ReactNode } from 'react';

import { DisplayNameProvider } from '@/components/account/DisplayNameProvider';
import { NotificationsProvider } from '@/components/notifications/NotificationsProvider';
import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import ShellFrame from '@/components/projects/ShellFrame';
import type { ProjectsShellUser } from '@/components/projects/shell';

export default function ProjectsShell({
  user,
  initialUnreadCount = 0,
  openTaskCount = 0,
  children,
}: {
  user: ProjectsShellUser;
  initialUnreadCount?: number;
  openTaskCount?: number;
  children: ReactNode;
}) {
  return (
    <DisplayNameProvider initialName={user.name} username={user.username}>
      <OpenPanelProvider>
        <NotificationsProvider initialUnreadCount={initialUnreadCount}>
          <ShellFrame user={user} openTaskCount={openTaskCount}>
            {children}
          </ShellFrame>
        </NotificationsProvider>
      </OpenPanelProvider>
    </DisplayNameProvider>
  );
}
