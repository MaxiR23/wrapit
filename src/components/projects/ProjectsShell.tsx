import type { ReactNode } from 'react';

import { DisplayNameProvider } from '@/components/account/DisplayNameProvider';
import { NotificationsProvider } from '@/components/notifications/NotificationsProvider';
import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import ProjectsMobileHeader from '@/components/projects/ProjectsMobileHeader';
import ProjectsMobileTabBar from '@/components/projects/ProjectsMobileTabBar';
import { ProjectsSearchProvider } from '@/components/projects/ProjectsSearch';
import ProjectsSidebar from '@/components/projects/ProjectsSidebar';
import ProjectsTopbar from '@/components/projects/ProjectsTopbar';
import type { ProjectsShellActiveNav, ProjectsShellUser } from '@/components/projects/shell';
import type { NotificationListItem } from '@/lib/notifications';
import { cn } from '@/lib/utils';

const defaultContentClassName =
  'projects-content-wash flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-4 pb-6 md:gap-[22px] md:px-5 md:pt-[22px] md:pb-[30px] lg:gap-[26px] lg:px-7 lg:pt-[26px] lg:pb-9';

export default function ProjectsShell({
  user,
  initialNotifications = [],
  activeNav = 'projects',
  openTaskCount = 0,
  showSearch = true,
  searchPlaceholder = 'Search projects',
  searchAriaLabel = 'Search projects',
  mobileTitle,
  contentClassName,
  children,
}: {
  user: ProjectsShellUser;
  initialNotifications?: NotificationListItem[];
  activeNav?: ProjectsShellActiveNav;
  openTaskCount?: number;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  mobileTitle?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <DisplayNameProvider initialName={user.name} username={user.username}>
      <OpenPanelProvider>
        <NotificationsProvider initialItems={initialNotifications}>
          <ProjectsSearchProvider>
            <div className="flex h-svh flex-1 overflow-hidden bg-background">
              <ProjectsSidebar activeNav={activeNav} openTaskCount={openTaskCount} />
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <ProjectsMobileHeader
                  user={user}
                  title={
                    mobileTitle ??
                    (activeNav === 'tasks'
                      ? 'My tasks'
                      : activeNav === 'archived'
                        ? 'Archived'
                        : activeNav === 'account'
                          ? 'Account'
                          : 'Projects')
                  }
                />
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
