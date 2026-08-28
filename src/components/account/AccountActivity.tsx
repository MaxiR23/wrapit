'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

import { listMyActivityEvents } from '@/actions/listMyActivityEvents';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  useViewerTimeZone,
  ViewerTimeZoneProvider,
} from '@/components/projects/ViewerTimeZoneProvider';
import { accountProjectRoleLine, type AccountProjectView } from '@/lib/accountActivity';
import type { AccountActivityEventListItem, ActivityCursor } from '@/lib/activity';
import { activityCopy } from '@/lib/activityCopy';
import {
  activityEventViewFromItem,
  activityQuote,
  activitySentence,
  collapseActivityEvents,
  formatActivityClockTime,
  groupActivityByDay,
  type ActivityEventView,
} from '@/lib/activityDisplay';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { projectPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

export default function AccountActivity({
  projects,
  initialItems,
  initialCursor,
  now = new Date(),
}: {
  projects: AccountProjectView[];
  initialItems: AccountActivityEventListItem[];
  initialCursor: ActivityCursor | null;
  now?: Date;
}) {
  return (
    <ViewerTimeZoneProvider>
      <AccountActivityBody
        projects={projects}
        initialItems={initialItems}
        initialCursor={initialCursor}
        now={now}
      />
    </ViewerTimeZoneProvider>
  );
}

function AccountActivityBody({
  projects,
  initialItems,
  initialCursor,
  now,
}: {
  projects: AccountProjectView[];
  initialItems: AccountActivityEventListItem[];
  initialCursor: ActivityCursor | null;
  now: Date;
}) {
  const viewerTimeZone = useViewerTimeZone();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  async function loadActivity(nextCursor?: ActivityCursor) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    try {
      const result = await listMyActivityEvents(nextCursor ? { cursor: nextCursor } : {});
      if (requestId !== requestIdRef.current) return;
      if ('error' in result) {
        setError(GENERIC_ERROR_MESSAGE);
        return;
      }
      setError(null);
      setItems((current) => (nextCursor ? [...current, ...result.data.items] : result.data.items));
      setCursor(result.data.nextCursor);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError(GENERIC_ERROR_MESSAGE);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  const views = collapseActivityEvents(items.map(activityEventViewFromItem));
  const days = groupActivityByDay(views, now);
  const noProjects = projects.length === 0;
  const emptyTimeline = !loading && items.length === 0 && error == null;
  const projectTitleById = new Map(items.map((item) => [item.id, item.projectTitle]));

  return (
    <div
      id="account-panel-activity"
      role="tabpanel"
      aria-labelledby="account-tab-activity"
      className="flex flex-col gap-6 px-7 py-6 pb-[34px]"
    >
      <section className="flex flex-col gap-[11px]" aria-label={activityCopy.yourProjects}>
        <h2 className="text-[13px] font-semibold text-foreground">{activityCopy.yourProjects}</h2>
        {projects.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-muted-foreground">
            {activityCopy.emptyProjects}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={projectPath(project.id)}
                className={cn(
                  shellFocusClassName,
                  'flex flex-col gap-1.5 rounded-md border border-border bg-surface p-[13px] no-underline',
                  'hover:border-border-strong hover:bg-card',
                )}
              >
                <span className="truncate text-[13.5px] font-medium text-foreground">
                  {project.title}
                </span>
                {project.description ? (
                  <span className="text-pretty text-xs leading-[1.45] text-muted-foreground">
                    {project.description}
                  </span>
                ) : null}
                <span className="pt-1 text-[11.5px] text-subtle">
                  {accountProjectRoleLine(project.role, project.assignedCount)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section
        className="flex flex-col gap-[18px]"
        aria-label={activityCopy.accountLogLabel}
        aria-busy={loading}
      >
        <h2 className="text-[13px] font-semibold text-foreground">{activityCopy.yourActivity}</h2>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {GENERIC_ERROR_MESSAGE}
          </p>
        ) : null}
        {emptyTimeline && !noProjects ? (
          <p className="py-6 text-center text-[13.5px] text-muted-foreground">
            {activityCopy.empty}
          </p>
        ) : null}
        {days.map((day) => (
          <div key={day.label} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <h3 className="text-[12.5px] font-semibold text-foreground">{day.label}</h3>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col">
              {day.items.map((event) => (
                <ActivityRow
                  key={event.id}
                  event={event}
                  projectTitle={projectTitleById.get(event.id) ?? ''}
                  viewerTimeZone={viewerTimeZone}
                />
              ))}
            </div>
          </div>
        ))}
        {cursor !== null ? (
          <button
            type="button"
            onClick={() => {
              if (cursor) void loadActivity(cursor);
            }}
            aria-disabled={loading}
            className={cn(
              shellFocusClassName,
              'self-center rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] font-medium text-muted-foreground',
              'hover:border-border-strong hover:text-foreground',
              loading && 'pointer-events-none opacity-60',
            )}
          >
            {activityCopy.loadEarlier}
          </button>
        ) : null}
      </section>
    </div>
  );
}

function ActivityRow({
  event,
  projectTitle,
  viewerTimeZone,
}: {
  event: ActivityEventView;
  projectTitle: string;
  viewerTimeZone: string | null;
}) {
  const quote = activityQuote(event);

  return (
    <article className="flex flex-col gap-1.5 border-b border-border px-1 py-[11px] md:grid md:grid-cols-[1fr_150px_68px] md:items-start md:gap-3.5">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-pretty text-[13.5px] leading-[1.45] text-foreground">
          {activitySentence(event, activityCopy, viewerTimeZone)}
        </p>
        {quote ? (
          <p className="line-clamp-4 rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px] leading-normal text-muted-foreground">
            {quote}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-3 md:contents">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{projectTitle}</span>
        <time
          dateTime={event.createdAt.toISOString()}
          className="shrink-0 text-xs text-subtle tabular-nums md:text-right"
        >
          {formatActivityClockTime(event.createdAt)}
        </time>
      </div>
    </article>
  );
}
