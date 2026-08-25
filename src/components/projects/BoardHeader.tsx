'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

import BoardFilterSummary from '@/components/projects/BoardFilterSummary';
import BoardFiltersPopover from '@/components/projects/BoardFiltersPopover';
import BoardVisibilityPopover from '@/components/projects/BoardVisibilityPopover';
import MemberPopover from '@/components/projects/MemberPopover';
import type { BoardMember } from '@/components/projects/boardTypes';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  activeFilterGroupCount,
  boardFilterSummary,
  emptyBoardFilters,
  type BoardFilters,
  type BoardVisibility,
} from '@/lib/boardView';
import type { LabelView } from '@/lib/labels';
import {
  boardProgressEmptyLabel,
  boardProgressLabel,
  boardProgressShortLabel,
} from '@/lib/projectGrid';
import { PROJECTS_PATH } from '@/lib/routes';
import { cn } from '@/lib/utils';

export default function BoardHeader({
  title,
  doneCount,
  taskCount,
  percent,
  members,
  labels,
  filters,
  onFiltersChange,
  visibility,
  onVisibilityChange,
  visibleCount,
}: {
  title: string;
  doneCount: number;
  taskCount: number;
  percent: number;
  members: BoardMember[];
  labels: LabelView[];
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
  visibility: BoardVisibility;
  onVisibilityChange: (visibility: BoardVisibility) => void;
  visibleCount: number;
}) {
  const hasCards = taskCount > 0;
  const { query, setQuery } = useProjectsSearch();
  const { openPanel, setOpenPanel } = useOpenPanel();
  const filterCount = activeFilterGroupCount(filters);
  const shareOpen = openPanel === 'share';

  return (
    <header
      className={cn(
        'grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3',
        'tablet:items-end tablet:gap-x-2.5 tablet:gap-y-[7px]',
        'bg-[radial-gradient(130%_70%_at_8%_-20%,oklch(1_0_0/0.07)_0%,transparent_62%)]',
        'lg:bg-[radial-gradient(120%_70%_at_10%_-20%,oklch(1_0_0/0.07)_0%,transparent_62%)]',
        'px-4 pt-0.5 pb-3 tablet:px-[18px] tablet:pt-5 tablet:pb-3.5 lg:px-7 lg:pt-6 lg:pb-4',
      )}
    >
      <Link
        href={PROJECTS_PATH}
        className={cn(
          shellFocusClassName,
          'col-start-1 row-start-1 text-[12px] text-subtle no-underline hover:text-muted-foreground',
        )}
      >
        Projects / Board
      </Link>
      <h1 className="col-start-1 row-start-2 col-span-2 text-[23px] font-semibold tracking-[-0.025em] text-pretty tablet:col-span-1 lg:text-[27px]">
        {title}
      </h1>
      {hasCards ? (
        <div className="col-start-1 row-start-3 col-span-2 flex items-center gap-2.5 tablet:col-span-1">
          <span className="block h-1 w-full overflow-hidden rounded-full bg-muted tablet:w-[104px] lg:w-[120px]">
            <span
              className="block h-full rounded-full bg-status-in-progress"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="hidden text-[12.5px] text-muted-foreground tabular-nums whitespace-nowrap tablet:inline">
            {boardProgressLabel(doneCount, taskCount)}
          </span>
          <span className="text-[12.5px] text-muted-foreground tabular-nums whitespace-nowrap tablet:hidden">
            {boardProgressShortLabel(doneCount, taskCount)}
          </span>
        </div>
      ) : (
        <p className="col-start-1 row-start-3 col-span-2 text-[12.5px] text-muted-foreground text-pretty tablet:col-span-1">
          {boardProgressEmptyLabel()}
        </p>
      )}
      <div className="col-start-1 row-start-4 col-span-2 flex flex-wrap items-center gap-2 tablet:col-start-2 tablet:row-start-1 tablet:row-span-3 tablet:flex-nowrap tablet:self-end tablet:gap-2">
        <div className="flex w-full items-center gap-1 tablet:w-auto">
          <MemberPopover members={members} />
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={shareOpen}
            onClick={() => setOpenPanel(shareOpen ? null : 'share')}
            className={cn(
              shellFocusClassName,
              'ml-0.5 inline-flex h-7 items-center gap-[5px] rounded-full border border-border bg-surface px-[11px] pl-[9px]',
              'text-[12.5px] font-medium text-muted-foreground tablet:ml-1 tablet:h-[30px] tablet:gap-1.5',
              shareOpen
                ? 'border-border-strong bg-card text-foreground'
                : 'hover:border-border-strong hover:bg-card hover:text-foreground',
            )}
          >
            <Plus className="size-[13px] tablet:size-3.5" strokeWidth={1.9} />
            Share
          </button>
        </div>
        <input
          type="search"
          placeholder="Search the board"
          aria-label="Search the board"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(
            shellFocusClassName,
            'h-10 min-w-0 flex-1 rounded-md border border-input bg-surface px-3.5 text-base text-foreground placeholder:text-subtle tablet:hidden',
          )}
        />
        <div className="mx-0.5 hidden h-6 w-px bg-border tablet:block" />
        <BoardFiltersPopover labels={labels} filters={filters} onChange={onFiltersChange} />
        <BoardVisibilityPopover visibility={visibility} onChange={onVisibilityChange} />
      </div>
      {filterCount > 0 ? (
        <div className="col-span-2">
          <BoardFilterSummary
            summary={boardFilterSummary({
              filters,
              labels,
              visibleCount,
              totalCount: taskCount,
            })}
            onClear={() => onFiltersChange(emptyBoardFilters())}
          />
        </div>
      ) : null}
    </header>
  );
}
