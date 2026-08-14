import type { ReactNode } from 'react';

import ProjectsMobileHeader from '@/components/projects/ProjectsMobileHeader';
import ProjectsMobileTabBar from '@/components/projects/ProjectsMobileTabBar';
import { ProjectsSearchProvider } from '@/components/projects/ProjectsSearch';
import ProjectsSidebar from '@/components/projects/ProjectsSidebar';
import ProjectsTopbar from '@/components/projects/ProjectsTopbar';
import type { ProjectsShellUser } from '@/components/projects/shell';

export default function ProjectsShell({
  user,
  children,
}: {
  user: ProjectsShellUser;
  children: ReactNode;
}) {
  return (
    <ProjectsSearchProvider>
      <div className="flex min-h-svh flex-1 bg-background">
        <ProjectsSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ProjectsMobileHeader user={user} />
          <ProjectsTopbar user={user} />
          <div className="projects-content-wash flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-4 pb-6 md:gap-[22px] md:px-5 md:pt-[22px] md:pb-[30px] lg:gap-[26px] lg:px-7 lg:pt-[26px] lg:pb-9">
            {children}
          </div>
          <ProjectsMobileTabBar />
        </div>
      </div>
    </ProjectsSearchProvider>
  );
}
