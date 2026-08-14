import { Archive, CircleHelp, LayoutGrid, ListChecks } from 'lucide-react';
import Link from 'next/link';

import ProjectsBrand from '@/components/projects/ProjectsBrand';
import { shellFocusClassName } from '@/components/projects/shell';
import { PROJECTS_PATH } from '@/lib/routes';
import { cn } from '@/lib/utils';

const navItemClassName =
  'flex items-center gap-2.5 rounded-md px-2.5 py-[9px] text-[13.5px] no-underline';

const collapsedItemClassName =
  'flex w-14 flex-col items-center gap-1 rounded-md px-0 py-[7px] pb-1.5 text-[9.5px] tracking-[0.01em] no-underline';

export default function ProjectsSidebar() {
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-border bg-surface md:flex',
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
        <Link
          href={PROJECTS_PATH}
          aria-current="page"
          className={cn(
            shellFocusClassName,
            collapsedItemClassName,
            'bg-card font-medium text-foreground lg:hidden',
          )}
        >
          <LayoutGrid className="size-[19px]" strokeWidth={1.5} />
          Projects
        </Link>
        <Link
          href={PROJECTS_PATH}
          aria-current="page"
          className={cn(
            shellFocusClassName,
            navItemClassName,
            'hidden bg-card font-medium text-foreground lg:flex',
          )}
        >
          <LayoutGrid className="size-[19px]" strokeWidth={1.5} />
          Projects
        </Link>

        <InactiveNav label="My tasks" CollapsedIcon={ListChecks} />
        <InactiveNav label="Archived" CollapsedIcon={Archive} />
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

function InactiveNav({
  label,
  CollapsedIcon,
}: {
  label: string;
  CollapsedIcon: typeof ListChecks;
}) {
  return (
    <>
      <span
        aria-disabled="true"
        className={cn(collapsedItemClassName, 'text-muted-foreground lg:hidden')}
      >
        <CollapsedIcon className="size-[19px]" strokeWidth={1.5} />
        {label}
      </span>
      <span
        aria-disabled="true"
        className={cn(navItemClassName, 'hidden text-muted-foreground lg:flex')}
      >
        <CollapsedIcon className="size-[19px]" strokeWidth={1.5} />
        {label}
      </span>
    </>
  );
}
