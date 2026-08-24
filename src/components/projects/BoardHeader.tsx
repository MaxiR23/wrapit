import Link from 'next/link';

import LabelsControl from '@/components/labels/LabelsControl';
import MemberPopover from '@/components/projects/MemberPopover';
import type { BoardMember } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
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
  projectId,
  labels,
  onLabelsChange,
}: {
  title: string;
  doneCount: number;
  taskCount: number;
  percent: number;
  members: BoardMember[];
  projectId: string;
  labels: LabelView[];
  onLabelsChange?: (labels: LabelView[]) => void;
}) {
  const hasCards = taskCount > 0;

  return (
    <header
      className={cn(
        'grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3',
        'tablet:grid-cols-[minmax(0,1fr)_auto_auto] tablet:items-end tablet:gap-x-2.5 tablet:gap-y-[7px]',
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
      <div className="col-start-1 row-start-4 col-span-2 tablet:col-start-2 tablet:row-start-1 tablet:row-span-3 tablet:self-end">
        <MemberPopover members={members} />
      </div>
      <div className="col-start-2 row-start-1 tablet:col-start-3 tablet:row-span-3 tablet:self-end">
        <LabelsControl projectId={projectId} labels={labels} onLabelsChange={onLabelsChange} />
      </div>
    </header>
  );
}
