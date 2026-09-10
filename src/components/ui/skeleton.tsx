import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

function RouteSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="route-skeleton flex min-h-0 flex-1 flex-col" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

export { RouteSkeleton, Skeleton };
