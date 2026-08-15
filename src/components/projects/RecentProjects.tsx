import Link from 'next/link';

import { shellFocusClassName } from '@/components/projects/shell';
import type { ProjectSummary } from '@/lib/projectGrid';
import { projectPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

export default function RecentProjects({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-xs text-subtle">Recents</span>
      {projects.map((project) => (
        <Link
          key={project.id}
          href={projectPath(project.id)}
          className={cn(
            shellFocusClassName,
            'inline-flex h-8 items-center gap-[9px] rounded-full border border-border bg-surface px-3 no-underline text-inherit hover:bg-card',
          )}
        >
          <span className="text-[13px] font-medium">{project.title}</span>
          <span className="text-xs text-muted-foreground">{project.percent}%</span>
        </Link>
      ))}
    </div>
  );
}
