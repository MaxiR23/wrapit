'use client';

import { Archive } from 'lucide-react';
import Link from 'next/link';
import {
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { projectListGridClassName } from '@/components/projects/projectListGrid';
import ProjectStarButton, { type OnToggleStar } from '@/components/projects/ProjectStarButton';
import { shellFocusClassName } from '@/components/projects/shell';
import { archivedCopy } from '@/lib/archivedCopy';
import { initials } from '@/lib/initials';
import { ARCHIVE_PROJECT_LABEL } from '@/lib/messages';
import { projectStatusBarClass, taskCountLabel, type ProjectSummary } from '@/lib/projectGrid';
import { projectPath } from '@/lib/routes';
import { startRowPointer, SWIPE_REVEAL_PX } from '@/lib/swipe';
import { cn } from '@/lib/utils';

const PHONE_LIST = '(max-width: 767px)';

function subscribePhoneList(onChange: () => void) {
  const mql = window.matchMedia?.(PHONE_LIST);
  if (!mql) return () => {};
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function phoneListMatches() {
  return window.matchMedia?.(PHONE_LIST).matches ?? false;
}

function phoneListServer() {
  return false;
}

export default function ProjectListRow({
  project,
  onToggle,
  onArchive,
}: {
  project: ProjectSummary;
  onToggle?: OnToggleStar;
  onArchive?: (project: ProjectSummary) => void;
}) {
  const swipeEnabled = useSyncExternalStore(subscribePhoneList, phoneListMatches, phoneListServer);
  const ignoreClickRef = useRef(false);
  const [swipe, setSwipe] = useState({ dx: 0, tween: false });

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    startRowPointer(event, {
      swipeEnabled,
      onSuppressClick: () => {
        ignoreClickRef.current = true;
      },
      onSwipeChange: (dx) => setSwipe({ dx, tween: false }),
      onSwipeEnd: (dx) => setSwipe({ dx, tween: true }),
      onCommitPositive: () => onToggle?.(project.id, !project.starred),
      onCommitNegative: () => onArchive?.(project),
      canCommitNegative: project.canAdminister,
    });
  }

  return (
    <div className="relative overflow-hidden md:overflow-visible">
      {swipeEnabled ? (
        <div className="absolute inset-0 flex md:hidden" aria-hidden>
          <div
            className={cn(
              'flex flex-1 items-center bg-ok-soft px-4 text-[13px] font-medium text-ok',
              swipe.dx > SWIPE_REVEAL_PX ? 'opacity-100' : 'opacity-0',
            )}
          >
            Star
          </div>
          <div
            className={cn(
              'flex flex-1 items-center justify-end bg-danger-soft px-4 text-[13px] font-medium text-danger',
              swipe.dx < -SWIPE_REVEAL_PX ? 'opacity-100' : 'opacity-0',
            )}
          >
            Archive
          </div>
        </div>
      ) : null}
      <div
        className="relative border-b border-border bg-card transition-[background] duration-[160ms] ease-in-out hover:bg-card-hover"
        style={
          swipeEnabled
            ? {
                transform: `translateX(${swipe.dx}px)`,
                transition: swipe.tween ? 'transform 0.18s ease' : 'none',
              }
            : undefined
        }
        onPointerDown={handlePointerDown}
      >
        <Link
          href={projectPath(project.id)}
          aria-label={project.title}
          onClick={(event) => {
            if (!ignoreClickRef.current) return;
            event.preventDefault();
            ignoreClickRef.current = false;
          }}
          className={cn(shellFocusClassName, 'absolute inset-0 z-0')}
        />
        <div
          className={cn(
            projectListGridClassName,
            'pointer-events-none relative z-[1] px-3.5 py-[13px] tabular-nums lg:px-4',
          )}
        >
          <div className="pointer-events-auto hidden items-center gap-1 justify-self-start md:flex">
            <ProjectStarButton
              projectId={project.id}
              starred={project.starred}
              onToggle={onToggle}
            />
            <button
              type="button"
              aria-label={ARCHIVE_PROJECT_LABEL}
              disabled={!project.canAdminister}
              title={project.canAdminister ? undefined : archivedCopy.projects.adminOnly}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!project.canAdminister) return;
                onArchive?.(project);
              }}
              className={cn(
                shellFocusClassName,
                'inline-flex rounded-sm text-subtle disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Archive className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{project.title}</span>
            <span className="text-xs text-muted-foreground">
              <span>{taskCountLabel(project.taskCount)}</span>
              <span className="lg:hidden"> · {project.updatedLabel}</span>
            </span>
          </div>
          <span className="hidden text-xs text-muted-foreground md:block">
            {project.statusLabel}
          </span>
          <div className="hidden items-center gap-2 md:flex lg:gap-[9px]">
            <span className="block h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn('block h-full rounded-full', projectStatusBarClass(project.status))}
                style={{ width: `${project.percent}%` }}
              />
            </span>
            <span className="w-8 text-right text-xs font-medium lg:w-[34px]">
              {project.percent}%
            </span>
          </div>
          <div className="hidden gap-1 md:flex">
            {project.members.map((member) => (
              <span
                key={member.id}
                title={member.name}
                className="inline-flex size-6 items-center justify-center rounded-full border border-border-strong bg-muted text-[9.5px] font-semibold leading-none"
              >
                {initials(member.name, member.username)}
              </span>
            ))}
          </div>
          <span className="hidden text-xs text-muted-foreground lg:block">
            {project.updatedLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
