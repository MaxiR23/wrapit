'use client';

import Link from 'next/link';
import { History, Plus } from 'lucide-react';

import ScreenHeader from '@/components/ScreenHeader';
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
    <div className="flex items-center gap-2.5">
      <span className="block h-1 w-full overflow-hidden rounded-full bg-muted tablet:w-[104px] lg:w-[120px]">
        <span
          className="block h-full rounded-full bg-status-in-progress"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="hidden text-[12.5px] tabular-nums whitespace-nowrap tablet:inline">
        {boardProgressLabel(doneCount, taskCount)}
      </span>
      <span className="text-[12.5px] tabular-nums whitespace-nowrap tablet:hidden">
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
        <>
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
          <button
            type="button"
            aria-label={ARCHIVE_PROJECT_LABEL}
            disabled={!canAdminister}
            title={canAdminister ? undefined : archivedCopy.projects.adminOnly}
            onClick={onArchive}
            className={cn(
              shellFocusClassName,
              'inline-flex h-10 items-center rounded-md border border-border bg-surface px-3',
              'text-[12.5px] font-medium text-muted-foreground hover:border-border-strong hover:text-foreground',
              'tablet:h-[38px] lg:h-9 disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            Archive
          </button>
          <Link
            href={projectArchivedPath(projectId)}
            className={cn(
              shellFocusClassName,
              'inline-flex h-10 items-center rounded-md border border-border bg-surface px-3',
              'text-[12.5px] font-medium text-muted-foreground hover:border-border-strong hover:text-foreground',
              'tablet:h-[38px] lg:h-9',
            )}
          >
            Archived
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
              'inline-flex items-center justify-center rounded-md border',
              'size-10 tablet:size-[38px] lg:size-9',
              logOpen
                ? 'border-border-strong bg-card text-foreground'
                : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            <History className="size-[17px]" strokeWidth={1.9} />
          </button>
        </>
      }
    >
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
