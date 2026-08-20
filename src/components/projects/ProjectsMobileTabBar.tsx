import { Archive, LayoutGrid, ListChecks, User } from 'lucide-react';
import Link from 'next/link';

import { shellFocusClassName } from '@/components/projects/shell';
import { PROJECTS_PATH } from '@/lib/routes';
import { cn } from '@/lib/utils';

const tabClassName =
  'flex min-h-11 flex-col items-center justify-center gap-1 text-[10.5px] no-underline';

export default function ProjectsMobileTabBar({
  activeNav = 'projects',
}: {
  activeNav?: 'projects' | null;
}) {
  const projectsActive = activeNav === 'projects';

  return (
    <nav
      aria-label="Main"
      className="grid h-16 shrink-0 grid-cols-4 border-t border-border bg-surface md:hidden"
    >
      <Link
        href={PROJECTS_PATH}
        aria-current={projectsActive ? 'page' : undefined}
        className={cn(
          shellFocusClassName,
          tabClassName,
          projectsActive ? 'font-medium text-foreground' : 'text-subtle',
        )}
      >
        <LayoutGrid className="size-5" strokeWidth={1.6} />
        Projects
      </Link>
      <span aria-disabled="true" className={cn(tabClassName, 'text-subtle')}>
        <ListChecks className="size-5" strokeWidth={1.5} />
        My tasks
      </span>
      <span aria-disabled="true" className={cn(tabClassName, 'text-subtle')}>
        <Archive className="size-5" strokeWidth={1.5} />
        Archived
      </span>
      <span aria-disabled="true" className={cn(tabClassName, 'text-subtle')}>
        <User className="size-5" strokeWidth={1.5} />
        Account
      </span>
    </nav>
  );
}
