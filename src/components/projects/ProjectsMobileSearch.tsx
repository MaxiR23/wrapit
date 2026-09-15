'use client';

import { Plus, Search } from 'lucide-react';

import { mobileAddButtonClassName, searchFieldDomProps } from '@/components/mobileChrome';
import NewProjectDialog from '@/components/projects/NewProjectDialog';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

export default function ProjectsMobileSearch() {
  const { query, setQuery } = useProjectsSearch();

  return (
    <div className="flex items-center gap-2.5 md:hidden">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-subtle"
          strokeWidth={1.6}
        />
        <input
          {...searchFieldDomProps}
          placeholder="Search projects"
          aria-label="Search projects"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(
            shellFocusClassName,
            'h-mobile-search w-full overflow-hidden rounded-md border border-input bg-surface pr-3 pl-9 text-base text-foreground placeholder:text-subtle',
          )}
        />
      </div>
      <NewProjectDialog>
        <button type="button" aria-label="New project" className={mobileAddButtonClassName}>
          <Plus className="size-5" strokeWidth={2} />
        </button>
      </NewProjectDialog>
    </div>
  );
}
