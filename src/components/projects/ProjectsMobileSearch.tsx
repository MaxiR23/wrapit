'use client';

import { Plus, Search } from 'lucide-react';

import NewProjectDialog from '@/components/projects/NewProjectDialog';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

export default function ProjectsMobileSearch() {
  const { query, setQuery } = useProjectsSearch();

  return (
    <div className="flex items-center gap-2.5 md:hidden">
      <div className="relative flex min-w-0 flex-1 items-center">
        <Search
          className="pointer-events-none absolute left-[13px] size-[18px] text-subtle"
          strokeWidth={1.6}
        />
        <input
          type="search"
          placeholder="Search projects"
          aria-label="Search projects"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(
            shellFocusClassName,
            'h-mobile-search w-full rounded-md border border-input bg-surface px-10 text-base text-foreground placeholder:text-subtle',
          )}
        />
      </div>
      <NewProjectDialog>
        <button
          type="button"
          aria-label="New project"
          className={cn(
            shellFocusClassName,
            'inline-flex size-mobile-search shrink-0 items-center justify-center rounded-md bg-primary text-[22px] leading-none text-primary-foreground hover:bg-primary/90',
          )}
        >
          <Plus className="size-5" strokeWidth={2} />
        </button>
      </NewProjectDialog>
    </div>
  );
}
