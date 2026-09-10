import { RouteSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function MyTasksLoading() {
  return (
    <RouteSkeleton>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 tablet:flex-row tablet:items-end tablet:justify-between">
          <div className="flex flex-col gap-1">
            <Skeleton className="hidden h-7 w-32 tablet:block" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-[3px] rounded-md border border-border bg-surface p-[3px] tablet:flex-none">
              <Skeleton className="h-[38px] flex-1 rounded-[6px] tablet:h-8 tablet:w-[72px] tablet:flex-none" />
              <Skeleton className="h-[38px] flex-1 rounded-[6px] tablet:h-8 tablet:w-[88px] tablet:flex-none" />
              <Skeleton className="h-[38px] flex-1 rounded-[6px] tablet:h-8 tablet:w-[52px] tablet:flex-none" />
            </div>
            <Skeleton className="size-[46px] rounded-md tablet:size-10 lg:h-9 lg:w-[108px]" />
          </div>
        </header>
        <div className="flex gap-[7px] overflow-x-auto">
          <Skeleton className="h-7 w-12 shrink-0 rounded-full" />
          <Skeleton className="h-7 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-7 w-20 shrink-0 rounded-full" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-[10px] border border-border bg-card px-4 py-[13px]">
              <div className="flex items-center gap-3.5">
                <Skeleton className="size-[18px] rounded-full" />
                <Skeleton className="h-4 min-w-0 flex-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </RouteSkeleton>
  );
}
