import ProjectListRow from '@/components/projects/ProjectListRow';
import { projectListGridClassName } from '@/components/projects/projectListGrid';
import type { ProjectSummary } from '@/lib/projectGrid';
import { cn } from '@/lib/utils';

export default function ProjectList({
  projects,
  className,
}: {
  projects: ProjectSummary[];
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      <div
        className={cn(
          projectListGridClassName,
          'border-b border-border bg-surface px-3.5 py-[11px] text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase lg:px-4',
        )}
      >
        <span />
        <span>Project</span>
        <span>Status</span>
        <span>Progress</span>
        <span>Team</span>
        <span className="hidden lg:block">Updated</span>
      </div>
      {projects.map((project) => (
        <ProjectListRow key={project.id} project={project} />
      ))}
    </div>
  );
}
