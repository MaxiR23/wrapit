import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import LabelsControl from '@/components/labels/LabelsControl';
import MemberPopover from '@/components/projects/MemberPopover';
import type { BoardMember } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import type { LabelView } from '@/lib/labels';
import { boardProgressLabel, boardProgressShortLabel } from '@/lib/projectGrid';
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
  return (
    <header className="flex shrink-0 flex-col gap-3 bg-[radial-gradient(130%_70%_at_8%_-20%,oklch(1_0_0/0.07)_0%,transparent_62%)] px-4 pt-0.5 pb-3 md:gap-3.5 md:px-7 md:pt-[26px]">
      <div className="flex min-h-[34px] items-center gap-2">
        <Link
          href={PROJECTS_PATH}
          className={cn(
            shellFocusClassName,
            'mr-auto inline-flex items-center gap-1 py-1.5 pr-1.5 text-[13px] text-subtle no-underline hover:text-foreground',
          )}
        >
          <ChevronLeft className="size-[15px]" strokeWidth={2} />
          Projects
        </Link>
        <LabelsControl projectId={projectId} labels={labels} onLabelsChange={onLabelsChange} />
      </div>

      <div className="flex flex-col gap-[9px]">
        <h1 className="text-[23px] font-semibold tracking-[-0.025em] text-pretty md:text-2xl lg:text-[27px]">
          {title}
        </h1>
        <div className="flex items-center gap-2.5">
          <span className="block h-1 flex-1 overflow-hidden rounded-full bg-muted md:h-[5px]">
            <span
              className="block h-full rounded-full bg-status-in-progress"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="hidden text-[12.5px] text-muted-foreground tabular-nums whitespace-nowrap md:inline">
            {boardProgressLabel(doneCount, taskCount)}
          </span>
          <span className="text-[12.5px] text-muted-foreground tabular-nums whitespace-nowrap md:hidden">
            {boardProgressShortLabel(doneCount, taskCount)}
          </span>
        </div>
        <div className="md:hidden">
          <MemberPopover members={members} interactive={false} />
        </div>
        <div className="hidden md:block">
          <MemberPopover members={members} interactive />
        </div>
      </div>
    </header>
  );
}
