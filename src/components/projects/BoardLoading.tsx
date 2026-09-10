import { RouteSkeleton, Skeleton } from '@/components/ui/skeleton';
import { BOARD_COLUMN_WIDTH_PX } from '@/lib/board';
import { cn } from '@/lib/utils';

function ColumnBone({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-[14px] border border-border bg-surface p-3',
        className,
      )}
    >
      <header className="flex items-center gap-[9px] border-b border-border px-1 pt-0.5 pb-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-5" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-[9px]">
        <Skeleton className="h-16 w-full rounded-[10px]" />
        <Skeleton className="h-16 w-full rounded-[10px]" />
        <Skeleton className="h-16 w-full rounded-[10px]" />
      </div>
    </section>
  );
}

export default function BoardLoading() {
  return (
    <RouteSkeleton>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 px-4 pt-0.5 pb-3 tablet:items-end tablet:gap-x-2.5 tablet:gap-y-[7px] tablet:px-[18px] tablet:pt-5 tablet:pb-3.5 lg:px-7 lg:pt-6 lg:pb-4">
          <Skeleton className="col-start-1 row-start-1 h-3 w-28" />
          <Skeleton className="col-start-1 row-start-2 col-span-2 h-7 w-48 tablet:col-span-1" />
          <Skeleton className="col-start-1 row-start-3 col-span-2 h-3 w-40 tablet:col-span-1" />
        </header>
        <div
          data-board="desktop"
          className="hidden min-h-0 flex-1 gap-3 overflow-x-auto px-[18px] pb-[18px] tablet:flex lg:gap-3.5 lg:px-7 lg:pb-7"
        >
          <ColumnBone className="w-[300px] flex-none lg:w-auto lg:flex-1 lg:min-w-0" />
          <ColumnBone className="w-[300px] flex-none lg:w-auto lg:flex-1 lg:min-w-0" />
          <ColumnBone className="w-[300px] flex-none lg:w-auto lg:flex-1 lg:min-w-0" />
        </div>
        <div data-board="mobile" className="flex min-h-0 flex-1 flex-col tablet:hidden">
          <div className="flex shrink-0 items-center justify-center gap-1.5 pb-2.5">
            <Skeleton className="h-1.5 w-5 rounded-full" />
            <Skeleton className="size-1.5 rounded-full" />
            <Skeleton className="size-1.5 rounded-full" />
          </div>
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-4 pb-3.5">
            <div
              className="flex h-full min-h-0 shrink-0 flex-col"
              style={{ width: BOARD_COLUMN_WIDTH_PX }}
            >
              <ColumnBone />
            </div>
          </div>
        </div>
      </div>
    </RouteSkeleton>
  );
}
