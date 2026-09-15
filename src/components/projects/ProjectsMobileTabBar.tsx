import { Archive, LayoutGrid, ListChecks, User } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import type { ProjectsShellActiveNav } from '@/components/projects/shell';
import { ACCOUNT_PATH, MY_TASKS_PATH, PROJECTS_PATH, ARCHIVED_PATH } from '@/lib/routes';
import { cn } from '@/lib/utils';

const tabClassName =
  'flex min-h-11 flex-col items-center justify-center gap-1 text-[10.5px] no-underline';

const tabFocusClassName =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';

const barStyle: CSSProperties = {
  boxSizing: 'border-box',
  paddingLeft: 'var(--spacing-mobile-tab-bar-inset)',
  paddingRight: 'var(--spacing-mobile-tab-bar-inset)',
  paddingBottom: 'var(--spacing-mobile-tab-bar-inset)',
  backgroundColor: 'transparent',
};

const surfaceStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  height: 'var(--spacing-mobile-tab-bar)',
  overflow: 'hidden',
  borderRadius: 'var(--radius-2xl)',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--mobile-tab-bar)',
  boxShadow: 'var(--shadow-mobile-tab-bar)',
};

export default function ProjectsMobileTabBar({
  activeNav = 'projects',
}: {
  activeNav?: ProjectsShellActiveNav;
}) {
  const projectsActive = activeNav === 'projects';
  const tasksActive = activeNav === 'tasks';
  const archivedActive = activeNav === 'archived';
  const accountActive = activeNav === 'account';

  return (
    <nav
      aria-label="Main"
      className="fixed z-30 safe-inset-x safe-inset-b tablet:hidden"
      style={barStyle}
    >
      <div style={surfaceStyle}>
        <Link
          href={PROJECTS_PATH}
          aria-current={projectsActive ? 'page' : undefined}
          className={cn(
            tabFocusClassName,
            tabClassName,
            projectsActive ? 'font-medium text-foreground' : 'text-subtle',
          )}
        >
          <LayoutGrid className="size-5" strokeWidth={1.6} />
          Projects
        </Link>
        <Link
          href={MY_TASKS_PATH}
          aria-current={tasksActive ? 'page' : undefined}
          className={cn(
            tabFocusClassName,
            tabClassName,
            tasksActive ? 'font-medium text-foreground' : 'text-subtle',
          )}
        >
          <ListChecks className="size-5" strokeWidth={1.5} />
          My tasks
        </Link>
        <Link
          href={ARCHIVED_PATH}
          aria-current={archivedActive ? 'page' : undefined}
          className={cn(
            tabFocusClassName,
            tabClassName,
            archivedActive ? 'font-medium text-foreground' : 'text-subtle',
          )}
        >
          <Archive className="size-5" strokeWidth={1.5} />
          Archived
        </Link>
        <Link
          href={ACCOUNT_PATH}
          aria-current={accountActive ? 'page' : undefined}
          className={cn(
            tabFocusClassName,
            tabClassName,
            accountActive ? 'font-medium text-foreground' : 'text-subtle',
          )}
        >
          <User className="size-5" strokeWidth={1.5} />
          Account
        </Link>
      </div>
    </nav>
  );
}
