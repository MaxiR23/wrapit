'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { screenInsetClassName } from '@/components/ScreenHeader';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import ProjectsMobileHeader from '@/components/projects/ProjectsMobileHeader';
import ProjectsMobileTabBar from '@/components/projects/ProjectsMobileTabBar';
import { ProjectsSearchProvider } from '@/components/projects/ProjectsSearch';
import ProjectsSidebar from '@/components/projects/ProjectsSidebar';
import { searchScopeForPath } from '@/components/projects/searchScope';
import { shellChromeForPath } from '@/components/projects/shellChrome';
import type { ProjectsShellUser } from '@/components/projects/shell';
import ProjectsTopbar from '@/components/projects/ProjectsTopbar';
import { cn } from '@/lib/utils';

const defaultContentClassName = cn(
  'projects-content-wash flex min-h-0 flex-col gap-5 overflow-auto pb-6 tablet:flex-1 md:gap-[22px] md:pb-[30px] lg:gap-[26px] lg:pb-9',
  screenInsetClassName,
);

const mobileTabBarOffsetClassName = 'max-tablet:pb-[var(--spacing-mobile-tab-bar)]';

const defaultMobileTabBarPadClassName =
  'max-tablet:pb-[calc(var(--spacing-mobile-tab-bar)+1.5rem)]';

export default function ShellFrame({
  user,
  openTaskCount = 0,
  children,
}: {
  user: ProjectsShellUser;
  openTaskCount?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const chrome = shellChromeForPath(pathname);
  const { setOpenPanel } = useOpenPanel();

  useLayoutEffect(() => {
    setOpenPanel(null);
  }, [pathname, setOpenPanel]);

  return (
    <ProjectsSearchProvider scope={searchScopeForPath(pathname)}>
      <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-background">
        <ProjectsSidebar activeNav={chrome.activeNav} openTaskCount={openTaskCount} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ProjectsMobileHeader user={user} title={chrome.mobileTitle} />
          <ProjectsTopbar
            user={user}
            showSearch={chrome.showSearch}
            searchPlaceholder={chrome.searchPlaceholder}
            searchAriaLabel={chrome.searchAriaLabel}
          />
          <div
            className={cn(
              chrome.contentClassName ?? defaultContentClassName,
              chrome.contentClassName
                ? mobileTabBarOffsetClassName
                : defaultMobileTabBarPadClassName,
            )}
          >
            {children}
          </div>
          <ProjectsMobileTabBar activeNav={chrome.activeNav} />
        </div>
      </div>
    </ProjectsSearchProvider>
  );
}
