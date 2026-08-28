import ProjectListRow from '@/components/projects/ProjectListRow';
import type { OnToggleStar } from '@/components/projects/ProjectStarButton';
import { projectListGridClassName } from '@/components/projects/projectListGrid';
import type { ProjectSummary } from '@/lib/projectGrid';
import { cn } from '@/lib/utils';

export default function ProjectList({
  projects,
  className,
  onToggle,
  onArchive,
}: {
  projects: ProjectSummary[];
  className?: string;
  onToggle?: OnToggleStar;
  onArchive?: (project: ProjectSummary) => void;
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      <div
        className={cn(
          projectListGridClassName,
          'border-b border-border bg-surface px-3.5 py-[11px] text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase lg:px-4',
        )}
      >
        <span className="hidden md:block" />
        <span>Project</span>
        <span className="hidden md:block">Status</span>
        <span className="hidden md:block">Progress</span>
        <span className="hidden md:block">Team</span>
        <span className="hidden lg:block">Updated</span>
      </div>
      {projects.map((project) => (
        <ProjectListRow
          key={project.id}
          project={project}
          onToggle={onToggle}
          onArchive={onArchive}
        />
      ))}
    </div>
  );
}
