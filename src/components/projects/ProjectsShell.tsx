import type { ReactNode } from 'react';

import { DisplayNameProvider } from '@/components/account/DisplayNameProvider';
import { NotificationsProvider } from '@/components/notifications/NotificationsProvider';
import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import ProjectsMobileHeader from '@/components/projects/ProjectsMobileHeader';
import ProjectsMobileTabBar from '@/components/projects/ProjectsMobileTabBar';
import { ProjectsSearchProvider } from '@/components/projects/ProjectsSearch';
import ProjectsSidebar from '@/components/projects/ProjectsSidebar';
import ProjectsTopbar from '@/components/projects/ProjectsTopbar';
import type { ProjectsShellUser } from '@/components/projects/shell';
import type { NotificationListItem } from '@/lib/notifications';
import { cn } from '@/lib/utils';

export type ProjectsShellActiveNav = 'projects' | null;

const defaultContentClassName =
  'projects-content-wash flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-4 pb-6 md:gap-[22px] md:px-5 md:pt-[22px] md:pb-[30px] lg:gap-[26px] lg:px-7 lg:pt-[26px] lg:pb-9';

export default function ProjectsShell({
  user,
  initialNotifications = [],
  activeNav = 'projects',
  showSearch = true,
  searchPlaceholder = 'Search projects',
  searchAriaLabel = 'Search projects',
  contentClassName,
  children,
}: {
  user: ProjectsShellUser;
  initialNotifications?: NotificationListItem[];
  activeNav?: ProjectsShellActiveNav;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <DisplayNameProvider initialName={user.name} username={user.username}>
      <OpenPanelProvider>
        <NotificationsProvider initialItems={initialNotifications}>
          <ProjectsSearchProvider>
            <div className="flex min-h-svh flex-1 bg-background">
              <ProjectsSidebar activeNav={activeNav} />
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <ProjectsMobileHeader user={user} />
                <ProjectsTopbar
                  user={user}
                  showSearch={showSearch}
                  searchPlaceholder={searchPlaceholder}
                  searchAriaLabel={searchAriaLabel}
                />
                <div className={cn(contentClassName ?? defaultContentClassName)}>{children}</div>
                <ProjectsMobileTabBar activeNav={activeNav} />
              </div>
            </div>
          </ProjectsSearchProvider>
        </NotificationsProvider>
      </OpenPanelProvider>
    </DisplayNameProvider>
  );
}
