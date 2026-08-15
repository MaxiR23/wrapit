'use client';

import { useMemo, useOptimistic, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { setProjectStarred } from '@/actions/setProjectStarred';
import { updateViewMode } from '@/actions/updateViewMode';
import ProjectGrid from '@/components/projects/ProjectGrid';
import ProjectList from '@/components/projects/ProjectList';
import ProjectsHeader, { type ProjectsViewMode } from '@/components/projects/ProjectsHeader';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import RecentProjects from '@/components/projects/RecentProjects';
import StarredProjects from '@/components/projects/StarredProjects';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import {
  applyOptimisticStarred,
  filterProjectsByTitle,
  starredMapFromProjects,
  type ProjectSummary,
} from '@/lib/projectGrid';

type StarWrite = {
  desired: boolean;
  persisted: boolean;
  inFlight: Promise<void> | null;
};

export default function ProjectsView({
  projects,
  recentProjects = [],
  initialView = 'grid',
}: {
  projects: ProjectSummary[];
  recentProjects?: ProjectSummary[];
  initialView?: ProjectsViewMode;
}) {
  const [view, setView] = useState<ProjectsViewMode>(initialView);
  const latestViewRef = useRef(initialView);
  const persistInFlightRef = useRef(false);
  const [starError, setStarError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const starWritesRef = useRef(new Map<string, StarWrite>());
  const serverStarredById = useMemo(() => starredMapFromProjects(projects), [projects]);
  const [optimisticStarredById, setOptimisticStarred] = useOptimistic(
    serverStarredById,
    applyOptimisticStarred,
  );
  const { query } = useProjectsSearch();
  const visible = filterProjectsByTitle(projects, query).map((project) => ({
    ...project,
    starred: optimisticStarredById[project.id] ?? project.starred,
  }));
  const starred = visible.filter((project) => project.starred);
  const rest = visible.filter((project) => !project.starred);
  const noMatches = visible.length === 0 && query.trim() !== '';

  function starWriteFor(projectId: string): StarWrite {
    let entry = starWritesRef.current.get(projectId);
    if (!entry) {
      const persisted = serverStarredById[projectId] ?? false;
      entry = { desired: persisted, persisted, inFlight: null };
      starWritesRef.current.set(projectId, entry);
    }
    return entry;
  }

  function persistStarred(projectId: string): Promise<void> {
    const entry = starWriteFor(projectId);
    if (entry.inFlight) return entry.inFlight;

    const run = (async () => {
      try {
        // Same coalescing loop as view-mode: write the latest desired value,
        // then continue until persisted matches that last intent.
        while (entry.desired !== entry.persisted) {
          const intended = entry.desired;
          const result = await setProjectStarred(projectId, intended);
          if ('error' in result) {
            throw new Error(result.error);
          }
          entry.persisted = intended;
        }
      } catch {
        entry.desired = entry.persisted;
        startTransition(() => {
          setOptimisticStarred({ projectId, starred: entry.persisted });
        });
        setStarError(GENERIC_ERROR_MESSAGE);
        router.refresh();
      } finally {
        if (starWritesRef.current.get(projectId) === entry) {
          entry.inFlight = null;
        }
      }
    })();
    entry.inFlight = run;
    return run;
  }

  function handleToggle(projectId: string, nextStarred: boolean) {
    const entry = starWriteFor(projectId);
    entry.desired = nextStarred;
    startTransition(async () => {
      setStarError(null);
      setOptimisticStarred({ projectId, starred: nextStarred });
      await persistStarred(projectId);
    });
  }

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
      {starError ? (
        <p role="alert" className="text-sm text-destructive">
          {starError}
        </p>
      ) : null}
      {recentProjects.length > 0 ? <RecentProjects projects={recentProjects} /> : null}
      {noMatches ? (
        <p className="text-sm text-muted-foreground">No projects match your search.</p>
      ) : (
        <>
          <StarredProjects projects={starred} onToggle={handleToggle} />
          {rest.length > 0 ? (
            view === 'list' ? (
              <>
                <div className="md:hidden">
                  <ProjectGrid projects={rest} onToggle={handleToggle} />
                </div>
                <ProjectList projects={rest} className="hidden md:block" onToggle={handleToggle} />
              </>
            ) : (
              <ProjectGrid projects={rest} onToggle={handleToggle} />
            )
          ) : null}
        </>
      )}
    </>
  );
}
