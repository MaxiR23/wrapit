import { Archive } from 'lucide-react';
import Link from 'next/link';

import ProjectStarButton, { type OnToggleStar } from '@/components/projects/ProjectStarButton';
import { shellFocusClassName } from '@/components/projects/shell';
import { archivedCopy } from '@/lib/archivedCopy';
import { initials } from '@/lib/initials';
import { ARCHIVE_PROJECT_LABEL } from '@/lib/messages';
import { projectStatusBarClass, taskProgressLabel, type ProjectSummary } from '@/lib/projectGrid';
import { projectPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

export default function ProjectCard({
  project,
  onToggle,
  onArchive,
}: {
  project: ProjectSummary;
  onToggle?: OnToggleStar;
  onArchive?: (project: ProjectSummary) => void;
}) {
  return (
    <article className="relative rounded-xl border border-border bg-card tabular-nums transition-[background,border-color] duration-[160ms] ease-in-out hover:border-border-strong hover:bg-card-hover">
      <Link
        href={projectPath(project.id)}
        className={cn(
          shellFocusClassName,
          'flex flex-col gap-4 rounded-xl p-[18px] no-underline text-inherit',
        )}
      >
        <div className="flex items-start gap-2.5 pr-6">
          <div className="mr-auto flex min-w-0 flex-col gap-1">
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">
              {project.title}
            </span>
            <span className="text-xs text-muted-foreground">{project.updatedLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">
              {taskProgressLabel(project.doneCount, project.taskCount)}
            </span>
            <span className="text-[12.5px] font-semibold">{project.percent}%</span>
          </div>
          <span className="block h-[5px] overflow-hidden rounded-full bg-muted">
            <span
              className={cn('block h-full rounded-full', projectStatusBarClass(project.status))}
              style={{ width: `${project.percent}%` }}
            />
          </span>
        </div>

        <div className="flex items-center gap-2.5 border-t border-border pt-3.5">
          <span className="mr-auto text-[11.5px] font-medium text-muted-foreground">
            {project.statusLabel}
          </span>
          <div className="flex gap-1">
            {project.members.map((member) => (
              <span
                key={member.id}
                title={member.name}
                className="inline-flex size-[26px] items-center justify-center rounded-full border border-border-strong bg-muted text-[10px] font-semibold leading-none"
              >
                {initials(member.name, member.username)}
              </span>
            ))}
          </div>
        </div>
      </Link>

      <div className="absolute top-[18px] right-[18px] z-10 flex items-center gap-1">
        <button
          type="button"
          aria-label={ARCHIVE_PROJECT_LABEL}
          disabled={!project.canAdminister}
          title={project.canAdminister ? undefined : archivedCopy.projects.adminOnly}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!project.canAdminister) return;
            onArchive?.(project);
          }}
          className={cn(
            shellFocusClassName,
            'inline-flex rounded-sm text-subtle disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <Archive className="size-3.5" strokeWidth={1.75} />
        </button>
        <ProjectStarButton projectId={project.id} starred={project.starred} onToggle={onToggle} />
      </div>
    </article>
  );
}
