'use client';

import {
  NotificationsBell,
  NotificationsSheet,
} from '@/components/notifications/NotificationsBell';
import ProjectsBrand from '@/components/projects/ProjectsBrand';
import { shellFocusClassName, type ProjectsShellUser } from '@/components/projects/shell';
import { useSignOut } from '@/components/projects/useSignOut';
import { cn } from '@/lib/utils';

export default function ProjectsMobileHeader({ user }: { user: ProjectsShellUser }) {
  const { signOut, error, isSigningOut } = useSignOut();

  return (
    <header className="flex h-mobile-header shrink-0 items-center gap-2.5 border-b border-border bg-surface px-4 md:hidden">
      <ProjectsBrand showName={false} />
      <span className="mr-auto text-base font-semibold tracking-[-0.01em]">Projects</span>
      <NotificationsBell
        className="size-11 text-muted-foreground hover:text-foreground"
        iconClassName="size-5"
        iconStrokeWidth={1.6}
      />
      <NotificationsSheet />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        aria-label="Account"
        onClick={signOut}
        disabled={isSigningOut}
        className={cn(
          shellFocusClassName,
          'inline-flex size-9 items-center justify-center rounded-full border border-border-strong bg-card text-xs font-semibold leading-none',
        )}
      >
        {user.initials}
      </button>
    </header>
  );
}
