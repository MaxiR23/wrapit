import Link from 'next/link';

import { projectListGridClassName } from '@/components/projects/projectListGrid';
import ProjectStarButton, { type OnToggleStar } from '@/components/projects/ProjectStarButton';
import { shellFocusClassName } from '@/components/projects/shell';
import { projectStatusBarClass, taskCountLabel, type ProjectSummary } from '@/lib/projectGrid';
import { projectPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

export default function ProjectListRow({
  project,
  onToggle,
}: {
  project: ProjectSummary;
  onToggle?: OnToggleStar;
}) {
  return (
    <div className="relative border-b border-border transition-[background] duration-[160ms] ease-in-out hover:bg-card-hover">
      <Link
        href={projectPath(project.id)}
        aria-label={project.title}
        className={cn(shellFocusClassName, 'absolute inset-0 z-0')}
      />
      <div
        className={cn(
          projectListGridClassName,
          'pointer-events-none relative z-[1] px-3.5 py-[13px] tabular-nums lg:px-4',
        )}
      >
        <ProjectStarButton
          projectId={project.id}
          starred={project.starred}
          onToggle={onToggle}
          className="pointer-events-auto justify-self-start"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{project.title}</span>
          <span className="text-xs text-muted-foreground">
            <span>{taskCountLabel(project.taskCount)}</span>
            <span className="lg:hidden"> · {project.updatedLabel}</span>
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{project.statusLabel}</span>
        <div className="flex items-center gap-2 lg:gap-[9px]">
          <span className="block h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn('block h-full rounded-full', projectStatusBarClass(project.status))}
              style={{ width: `${project.percent}%` }}
            />
          </span>
          <span className="w-8 text-right text-xs font-medium lg:w-[34px]">{project.percent}%</span>
        </div>
        <div className="flex gap-1">
          {project.members.map((member) => (
            <span
              key={member.id}
              title={member.name}
              className="inline-flex size-6 items-center justify-center rounded-full border border-border-strong bg-muted text-[9.5px] font-semibold leading-none"
            >
              {member.initials}
            </span>
          ))}
        </div>
        <span className="hidden text-xs text-muted-foreground lg:block">
          {project.updatedLabel}
        </span>
      </div>
    </div>
  );
}
