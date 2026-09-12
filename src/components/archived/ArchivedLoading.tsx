import ScreenHeader from '@/components/ScreenHeader';
import { RouteSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function ArchivedLoading() {
  return (
    <RouteSkeleton>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <ScreenHeader
          breadcrumb={<Skeleton className="h-3 w-36" />}
          title={<Skeleton className="h-7 w-32" />}
          subtitle={<Skeleton className="h-3.5 w-24" />}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex flex-wrap gap-[3px] rounded-md border border-border bg-surface p-[3px]">
              <Skeleton className="h-7 w-12 rounded-[6px]" />
              <Skeleton className="h-7 w-12 rounded-[6px]" />
              <Skeleton className="h-7 w-14 rounded-[6px]" />
              <Skeleton className="h-7 w-14 rounded-[6px]" />
            </div>
            <Skeleton className="size-[38px] rounded-md tablet:h-[34px] tablet:w-36" />
          </div>
        </ScreenHeader>
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="border-b border-border px-4 py-3 last:border-b-0">
              <Skeleton className="h-4 w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </RouteSkeleton>
  );
}
