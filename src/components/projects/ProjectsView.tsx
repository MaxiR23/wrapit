'use client';

import { useRef, useState } from 'react';

import { updateViewMode } from '@/actions/updateViewMode';
import ProjectGrid from '@/components/projects/ProjectGrid';
import ProjectList from '@/components/projects/ProjectList';
import ProjectsHeader, { type ProjectsViewMode } from '@/components/projects/ProjectsHeader';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { filterProjectsByTitle, type ProjectSummary } from '@/lib/projectGrid';

export default function ProjectsView({
  projects,
  initialView = 'grid',
}: {
  projects: ProjectSummary[];
  initialView?: ProjectsViewMode;
}) {
  const [view, setView] = useState<ProjectsViewMode>(initialView);
  const latestViewRef = useRef(initialView);
  const persistInFlightRef = useRef(false);
  const { query } = useProjectsSearch();
  const visible = filterProjectsByTitle(projects, query);
  const noMatches = visible.length === 0 && query.trim() !== '';

  function handleViewChange(next: ProjectsViewMode) {
    setView(next);
    latestViewRef.current = next;
    void persistLatest();
  }

  async function persistLatest() {
    if (persistInFlightRef.current) return;
    persistInFlightRef.current = true;
    try {
      let intended: ProjectsViewMode;
      do {
        intended = latestViewRef.current;
        await updateViewMode({ viewMode: intended });
      } while (latestViewRef.current !== intended);
    } catch {
      // A failed write must not block later selections.
    } finally {
      persistInFlightRef.current = false;
    }
  }

  return (
    <>
      <ProjectsHeader count={visible.length} view={view} onViewChange={handleViewChange} />
      {noMatches ? (
        <p className="text-sm text-muted-foreground">No projects match your search.</p>
      ) : view === 'list' ? (
        <>
          <div className="md:hidden">
            <ProjectGrid projects={visible} />
          </div>
          <ProjectList projects={visible} className="hidden md:block" />
        </>
      ) : (
        <ProjectGrid projects={visible} />
      )}
    </>
  );
}
