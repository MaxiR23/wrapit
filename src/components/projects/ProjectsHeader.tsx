'use client';

import { Plus } from 'lucide-react';

import NewProjectDialog from '@/components/projects/NewProjectDialog';
import { shellFocusClassName } from '@/components/projects/shell';
import { projectCountLabel } from '@/lib/projectGrid';
import { cn } from '@/lib/utils';

export type ProjectsViewMode = 'grid' | 'list';

const toggleButtonClassName =
  'h-[34px] rounded-[6px] px-3.5 text-[13px] font-medium md:h-8 lg:h-[30px] lg:px-[13px]';

export default function ProjectsHeader({
  count,
  view,
  onViewChange,
}: {
  count: number;
  view: ProjectsViewMode;
  onViewChange: (view: ProjectsViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 md:gap-2.5 lg:gap-3">
      <div className="mr-auto flex flex-col gap-[5px]">
        <h1 className="hidden text-2xl font-semibold tracking-[-0.025em] md:block lg:text-[27px]">
          Projects
        </h1>
        <span className="text-[12.5px] text-muted-foreground md:text-[13px]">
          {projectCountLabel(count)}
        </span>
      </div>

      <div className="flex gap-[3px] rounded-md border border-border bg-surface p-[3px]">
        <button
          type="button"
          aria-pressed={view === 'grid'}
          onClick={() => onViewChange('grid')}
          className={cn(
            shellFocusClassName,
            toggleButtonClassName,
            view === 'grid' ? 'bg-card text-foreground' : 'bg-transparent text-muted-foreground',
          )}
        >
          Grid
        </button>
        <button
          type="button"
          aria-pressed={view === 'list'}
          onClick={() => onViewChange('list')}
          className={cn(
            shellFocusClassName,
            toggleButtonClassName,
            view === 'list' ? 'bg-card text-foreground' : 'bg-transparent text-muted-foreground',
          )}
        >
          List
        </button>
      </div>

      <NewProjectDialog>
        <button
          type="button"
          className={cn(
            shellFocusClassName,
            'hidden items-center gap-[7px] rounded-md bg-primary px-[15px] text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90',
            'h-[38px] md:inline-flex lg:h-9',
          )}
        >
          <Plus className="size-[15px]" strokeWidth={2.2} />
          New project
        </button>
      </NewProjectDialog>
    </div>
  );
}
