import ScreenHeader from '@/components/ScreenHeader';
import { RouteSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function AccountLoading() {
  return (
    <RouteSkeleton>
      <div className="flex min-h-0 flex-1 flex-col">
        <ScreenHeader
          inset="pane"
          leading={<Skeleton className="size-11 shrink-0 rounded-full" />}
          title={<Skeleton className="h-7 w-40" />}
          subtitle={<Skeleton className="h-3.5 w-24" />}
        >
          <div className="flex gap-[22px] border-b border-border">
            <Skeleton className="mb-[-1px] h-8 w-14 rounded-none" />
            <Skeleton className="mb-[-1px] h-8 w-20 rounded-none" />
            <Skeleton className="mb-[-1px] h-8 w-16 rounded-none" />
          </div>
        </ScreenHeader>
        <div className="min-h-0 overflow-auto tablet:flex-1">
          <div className="flex flex-col gap-[26px] px-7 py-6 pb-[34px]">
            <div className="flex flex-col rounded-lg border border-border bg-surface p-[18px]">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-8 w-full" />
              <Skeleton className="mt-2 h-8 w-full" />
            </div>
            <div className="flex flex-col rounded-lg border border-border bg-surface p-[18px]">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-full" />
              <Skeleton className="mt-2 h-8 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </RouteSkeleton>
  );
}
