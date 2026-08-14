'use client';

import { useState } from 'react';

import ProjectGrid from '@/components/projects/ProjectGrid';
import ProjectList from '@/components/projects/ProjectList';
import ProjectsHeader, { type ProjectsViewMode } from '@/components/projects/ProjectsHeader';
import type { ProjectSummary } from '@/lib/projectGrid';

export default function ProjectsView({ projects }: { projects: ProjectSummary[] }) {
  const [view, setView] = useState<ProjectsViewMode>('grid');

  return (
    <>
      <ProjectsHeader count={projects.length} view={view} onViewChange={setView} />
      {view === 'list' ? (
        <>
          <div className="md:hidden">
            <ProjectGrid projects={projects} />
          </div>
          <ProjectList projects={projects} className="hidden md:block" />
        </>
      ) : (
        <ProjectGrid projects={projects} />
      )}
    </>
  );
}
