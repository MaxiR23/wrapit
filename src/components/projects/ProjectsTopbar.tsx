'use client';

import { Bell } from 'lucide-react';

import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { shellFocusClassName, type ProjectsShellUser } from '@/components/projects/shell';
import { useSignOut } from '@/components/projects/useSignOut';
import { cn } from '@/lib/utils';

export default function ProjectsTopbar({ user }: { user: ProjectsShellUser }) {
  const { query, setQuery } = useProjectsSearch();
  const { signOut, error, isSigningOut } = useSignOut();

  return (
    <header
      className={cn(
        'hidden shrink-0 items-center border-b border-border md:flex',
        'h-[60px] gap-3 px-5 lg:h-topbar lg:gap-3.5 lg:px-7',
      )}
    >
      <div className="relative mr-auto flex items-center">
        <input
          type="search"
          placeholder="Search projects"
          aria-label="Search projects"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(
            shellFocusClassName,
            'rounded-md border border-input bg-surface text-foreground placeholder:text-subtle',
            'h-[38px] w-[240px] px-3.5 text-sm lg:h-9 lg:w-[300px] lg:pr-16 lg:text-[13.5px]',
          )}
        />
        <kbd className="pointer-events-none absolute right-2.5 hidden rounded-[5px] border border-border px-1.5 py-0.5 text-[11px] text-subtle lg:inline">
          ⌘K
        </kbd>
      </div>

      <button
        type="button"
        aria-label="Notifications"
        className={cn(
          shellFocusClassName,
          'relative inline-flex items-center justify-center rounded-md border border-border text-muted-foreground',
          'size-10 hover:border-border-strong hover:text-foreground lg:size-9',
        )}
      >
        <Bell className="size-[18px] lg:size-[17px]" strokeWidth={1.8} />
      </button>

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
          'flex items-center gap-2.5 border-l border-border pl-3.5',
        )}
      >
        <span className="hidden flex-col items-end gap-px lg:flex">
          <span className="text-[13px] font-medium">{user.name}</span>
          <span className="text-[11.5px] text-muted-foreground">{user.username}</span>
        </span>
        <span className="inline-flex size-8 items-center justify-center rounded-full border border-border-strong bg-card text-[11.5px] font-semibold leading-none">
          {user.initials}
        </span>
      </button>
    </header>
  );
}
