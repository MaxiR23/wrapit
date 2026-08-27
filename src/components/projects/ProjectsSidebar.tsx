import { Archive, CircleHelp, LayoutGrid, ListChecks } from 'lucide-react';
import Link from 'next/link';

import ProjectsBrand from '@/components/projects/ProjectsBrand';
import { shellFocusClassName } from '@/components/projects/shell';
import { MY_TASKS_PATH, PROJECTS_PATH, ARCHIVED_PATH } from '@/lib/routes';
import { cn } from '@/lib/utils';

const navItemClassName =
  'flex items-center gap-2.5 rounded-md px-2.5 py-[9px] text-[13.5px] no-underline';

const collapsedItemClassName =
  'flex w-14 flex-col items-center gap-1 rounded-md px-0 py-[7px] pb-1.5 text-[9.5px] tracking-[0.01em] no-underline';

export default function ProjectsSidebar({
  activeNav = 'projects',
  openTaskCount = 0,
}: {
  activeNav?: 'projects' | 'tasks' | 'archived' | null;
  openTaskCount?: number;
}) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-border bg-surface tablet:flex',
        'w-sidebar-collapsed items-center gap-[22px] py-[18px]',
        'lg:w-sidebar lg:items-stretch lg:gap-7 lg:px-4 lg:py-[22px]',
      )}
    >
      <div className="lg:hidden">
        <ProjectsBrand compact showName={false} />
      </div>
      <div className="hidden lg:block">
        <ProjectsBrand />
      </div>

      <nav className="flex flex-col gap-1 lg:gap-[3px]" aria-label="Main">
        <NavLink
          href={PROJECTS_PATH}
          label="Projects"
          active={activeNav === 'projects'}
          Icon={LayoutGrid}
        />
        <NavLink
          href={MY_TASKS_PATH}
          label="My tasks"
          active={activeNav === 'tasks'}
          Icon={ListChecks}
          count={openTaskCount}
        />
        <NavLink
          href={ARCHIVED_PATH}
          label="Archived"
          active={activeNav === 'archived'}
          Icon={Archive}
        />
      </nav>

      <button
        type="button"
        className={cn(
          shellFocusClassName,
          collapsedItemClassName,
          'mt-auto text-subtle hover:bg-card hover:text-foreground lg:hidden',
        )}
      >
        <CircleHelp className="size-[19px]" strokeWidth={1.5} />
        Help
      </button>
      <button
        type="button"
        className={cn(
          shellFocusClassName,
          navItemClassName,
          'mt-auto hidden text-[12.5px] text-subtle hover:text-muted-foreground lg:flex',
        )}
      >
        <CircleHelp className="size-[19px]" strokeWidth={1.5} />
        Help and shortcuts
      </button>
    </aside>
  );
}

function NavLink({
  href,
  label,
  active,
  Icon,
  count,
}: {
  href: string;
  label: string;
  active: boolean;
  Icon: typeof ListChecks;
  count?: number;
}) {
  const activeClass = 'bg-card font-medium text-foreground';
  const idleClass = 'text-muted-foreground hover:bg-card hover:text-foreground';

  return (
    <>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          shellFocusClassName,
          collapsedItemClassName,
          active ? activeClass : idleClass,
          'lg:hidden',
        )}
      >
        <Icon className="size-[19px]" strokeWidth={1.5} />
        {label}
      </Link>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          shellFocusClassName,
          navItemClassName,
          active ? activeClass : idleClass,
          'hidden lg:flex',
        )}
      >
        <Icon className="size-[19px]" strokeWidth={1.5} />
        {label}
        {count != null ? (
          <span className="ml-auto text-[11.5px] font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </Link>
    </>
  );
}
