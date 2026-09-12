import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const screenInsetClassName =
  'px-screen-x pt-screen-pt md:px-screen-x-md md:pt-screen-pt-md lg:px-screen-x-lg lg:pt-screen-pt-lg';

export const screenHeaderIdentityClassName =
  'flex min-h-screen-header flex-col gap-screen-header-gap tablet:min-h-screen-header-tablet lg:min-h-screen-header-lg';

const titleClassName =
  'text-screen-title font-semibold tracking-screen-title text-pretty tablet:text-screen-title-tablet lg:text-screen-title-lg';

export default function ScreenHeader({
  breadcrumb,
  title,
  subtitle,
  leading,
  actions,
  inset = 'flush',
  children,
  className,
}: {
  breadcrumb?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  inset?: 'flush' | 'pane';
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      data-slot="screen-header"
      className={cn(
        'flex shrink-0 flex-col gap-screen-header-gap',
        inset === 'pane' && 'projects-content-wash',
        inset === 'pane' && screenInsetClassName,
        className,
      )}
    >
      <div data-slot="screen-header-identity" className={screenHeaderIdentityClassName}>
        <div className="flex h-screen-breadcrumb min-w-0 items-center">
          {breadcrumb ? (
            <nav className="min-w-0 truncate text-screen-breadcrumb text-subtle">{breadcrumb}</nav>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3.5">
            {leading}
            <div className="min-w-0">
              <h1 className={titleClassName}>{title}</h1>
              {subtitle ? (
                <div className="mt-screen-header-subtitle text-screen-subtitle text-muted-foreground">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div
              data-slot="screen-header-actions"
              className="flex w-full min-w-0 flex-wrap items-center gap-2 tablet:w-auto"
            >
              {actions}
            </div>
          ) : null}
        </div>
      </div>
      {children}
    </header>
  );
}
