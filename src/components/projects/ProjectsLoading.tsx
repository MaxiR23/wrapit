import ScreenHeader from '@/components/ScreenHeader';
import { RouteSkeleton, Skeleton } from '@/components/ui/skeleton';

function ProjectCardBone() {
  return (
    <div className="rounded-xl border border-border bg-card p-[18px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-[5px] w-full rounded-full" />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3.5">
          <Skeleton className="h-3 w-16" />
          <div className="flex gap-1">
            <Skeleton className="size-[26px] rounded-full" />
            <Skeleton className="size-[26px] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsLoading() {
  return (
    <RouteSkeleton>
      <div className="flex items-center gap-2.5 md:hidden">
        <Skeleton className="h-mobile-search min-w-0 flex-1 rounded-md" />
        <Skeleton className="size-mobile-search shrink-0 rounded-md" />
      </div>
      <ScreenHeader
        title={<Skeleton className="h-7 w-32" />}
        subtitle={<Skeleton className="h-3.5 w-20" />}
        actions={
          <>
            <Skeleton className="h-[34px] w-[140px] rounded-md md:h-8 lg:h-[30px]" />
            <Skeleton className="hidden h-[38px] w-[132px] rounded-md md:block lg:h-9" />
          </>
        }
      />
      <ul className="m-0 grid list-none grid-cols-[repeat(1,minmax(0,1fr))] gap-3.5 p-0 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="min-w-0">
            <ProjectCardBone />
          </li>
        ))}
      </ul>
    </RouteSkeleton>
  );
}
