'use client';

import Link from 'next/link';
import { Archive, ArchiveRestore, History, Plus, Search } from 'lucide-react';

import ScreenHeader from '@/components/ScreenHeader';
import { searchFieldDomProps } from '@/components/mobileChrome';
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
import { activityCopy } from '@/lib/activityCopy';
import { archivedCopy } from '@/lib/archivedCopy';
import { ARCHIVE_PROJECT_LABEL } from '@/lib/messages';
import {
  boardProgressEmptyLabel,
  boardProgressLabel,
  boardProgressShortLabel,
} from '@/lib/projectGrid';
import { PROJECTS_PATH, projectArchivedPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

export default function BoardHeader({
  title,
  projectId,
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
  logOpen = false,
  onToggleLog,
  canAdminister = true,
  onArchive,
}: {
  title: string;
  projectId: string;
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
  logOpen?: boolean;
  onToggleLog?: () => void;
  canAdminister?: boolean;
  onArchive?: () => void;
}) {
  const hasCards = taskCount > 0;
  const { query, setQuery } = useProjectsSearch();
  const { openPanel, setOpenPanel } = useOpenPanel();
  const filterCount = activeFilterGroupCount(filters);
  const shareOpen = openPanel === 'share';

  const progress = hasCards ? (
    <div className="flex w-full min-w-0 items-center gap-2.5">
      <span
        data-slot="board-progress"
        className="block h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted tablet:w-[104px] tablet:flex-none lg:w-[120px]"
      >
        <span
          className="block h-full rounded-full bg-status-in-progress"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="hidden text-[12.5px] tabular-nums whitespace-nowrap lg:inline">
        {boardProgressLabel(doneCount, taskCount)}
      </span>
      <span className="text-[12.5px] tabular-nums whitespace-nowrap lg:hidden">
        {boardProgressShortLabel(doneCount, taskCount)}
      </span>
    </div>
  ) : (
    boardProgressEmptyLabel()
  );

  return (
    <ScreenHeader
      inset="pane"
      className="pb-3 lg:pb-4"
      breadcrumb={
        <Link
          href={PROJECTS_PATH}
          className={cn(shellFocusClassName, 'rounded-sm no-underline hover:text-muted-foreground')}
        >
          Projects / Board
        </Link>
      }
      title={title}
      subtitle={progress}
      actions={
        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 tablet:flex-nowrap">
          <MemberPopover members={members} />
          <button
            type="button"
            aria-label="Share"
            aria-haspopup="dialog"
            aria-expanded={shareOpen}
            onClick={() => setOpenPanel(shareOpen ? null : 'share')}
            className={cn(
              shellFocusClassName,
              'inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface',
              'size-10 text-muted-foreground hover:border-border-strong hover:text-foreground',
              'lg:ml-1 lg:h-[30px] lg:w-auto lg:gap-1.5 lg:rounded-full lg:px-[11px] lg:pl-[9px]',
              'lg:text-[12.5px] lg:font-medium',
              shareOpen
                ? 'border-border-strong bg-card text-foreground'
                : 'hover:border-border-strong hover:bg-card hover:text-foreground',
            )}
          >
            <Plus className="size-[17px] lg:size-[13px]" strokeWidth={1.9} />
            <span className="hidden lg:inline">Share</span>
          </button>
          <div className="mx-0.5 hidden h-6 w-px bg-border lg:block" />
          <BoardFiltersPopover labels={labels} filters={filters} onChange={onFiltersChange} />
          <BoardVisibilityPopover visibility={visibility} onChange={onVisibilityChange} />
          <button
            type="button"
            aria-label={ARCHIVE_PROJECT_LABEL}
            disabled={!canAdminister}
            title={canAdminister ? undefined : archivedCopy.projects.adminOnly}
            onClick={onArchive}
            className={cn(
              shellFocusClassName,
              'inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface',
              'size-10 text-muted-foreground hover:border-border-strong hover:text-foreground',
              'lg:h-9 lg:w-auto lg:px-3 lg:text-[12.5px] lg:font-medium',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Archive className="size-[17px] lg:hidden" strokeWidth={1.9} />
            <span className="hidden lg:inline">Archive</span>
          </button>
          <Link
            href={projectArchivedPath(projectId)}
            aria-label="Archived"
            className={cn(
              shellFocusClassName,
              'inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface',
              'size-10 text-muted-foreground hover:border-border-strong hover:text-foreground',
              'lg:h-9 lg:w-auto lg:px-3 lg:text-[12.5px] lg:font-medium',
            )}
          >
            <ArchiveRestore className="size-[17px] lg:hidden" strokeWidth={1.9} />
            <span className="hidden lg:inline">Archived</span>
          </Link>
          <button
            type="button"
            aria-label={activityCopy.logLabel}
            aria-pressed={logOpen}
            title={activityCopy.logLabel}
            onClick={() => {
              setOpenPanel(null);
              onToggleLog?.();
            }}
            className={cn(
              shellFocusClassName,
              'inline-flex shrink-0 items-center justify-center rounded-md border',
              'size-10',
              logOpen
                ? 'border-border-strong bg-card text-foreground'
                : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            <History className="size-[17px]" strokeWidth={1.9} />
          </button>
        </div>
      }
    >
      <label className="relative tablet:hidden">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <input
          {...searchFieldDomProps}
          placeholder="Search the board"
          aria-label="Search the board"
          value={query}
          disabled={!hasCards}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(
            shellFocusClassName,
            'h-10 w-full overflow-hidden rounded-md border border-input bg-surface pr-3 pl-9 text-base text-foreground placeholder:text-subtle',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
      </label>
      {filterCount > 0 ? (
        <BoardFilterSummary
          summary={boardFilterSummary({
            filters,
            labels,
            visibleCount,
            totalCount: taskCount,
          })}
          onClear={() => onFiltersChange(emptyBoardFilters())}
        />
      ) : null}
    </ScreenHeader>
  );
}
