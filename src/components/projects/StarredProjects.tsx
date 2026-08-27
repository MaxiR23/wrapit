import ProjectGrid from '@/components/projects/ProjectGrid';
import type { OnToggleStar } from '@/components/projects/ProjectStarButton';
import type { ProjectSummary } from '@/lib/projectGrid';

export default function StarredProjects({
  projects,
  onToggle,
  onArchive,
}: {
  projects: ProjectSummary[];
  onToggle?: OnToggleStar;
  onArchive?: (project: ProjectSummary) => void;
}) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="starred-projects-heading">
      <div className="flex items-center gap-2">
        <h2 id="starred-projects-heading" className="text-[12.5px] font-semibold tracking-[0.02em]">
          Starred
        </h2>
        <span className="rounded-full border border-border bg-surface px-2 py-px text-[11.5px] text-muted-foreground">
          {projects.length}
        </span>
      </div>
      <ProjectGrid projects={projects} onToggle={onToggle} onArchive={onArchive} />
    </section>
  );
}
