'use client';

import { activityCopy } from '@/lib/activityCopy';
import type { ActivityEventListItem } from '@/lib/activity';
import {
  activityEventViewFromItem,
  activityQuote,
  activitySentence,
  collapseActivityEvents,
  formatActivityClockTime,
  groupActivityByDay,
  type ActivityEventView,
} from '@/lib/activityDisplay';
import { initials } from '@/lib/initials';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';

export default function BoardActivityLog({
  items,
  loading,
  error,
  hasMore,
  onLoadMore,
  now = new Date(),
}: {
  items: ActivityEventListItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  now?: Date;
}) {
  const views = collapseActivityEvents(items.map(activityEventViewFromItem));
  const days = groupActivityByDay(views, now);
  const empty = !loading && items.length === 0 && error == null;

  return (
    <div
      role="region"
      aria-label={activityCopy.logLabel}
      aria-busy={loading}
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-1 pb-5 tablet:gap-[22px] tablet:px-[18px] tablet:pb-7 lg:px-7"
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {GENERIC_ERROR_MESSAGE}
        </p>
      ) : null}
      {empty ? (
        <p className="py-10 text-center text-[13.5px] text-muted-foreground">
          {activityCopy.empty}
        </p>
      ) : null}
      {days.map((day) => (
        <section key={day.label} className="flex flex-col gap-2 tablet:gap-2.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[12.5px] font-semibold text-foreground">{day.label}</h2>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col">
            {day.items.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className={cn(
            shellFocusClassName,
            'self-center rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] font-medium text-muted-foreground',
            'hover:border-border-strong hover:text-foreground',
          )}
        >
          {activityCopy.loadEarlier}
        </button>
      ) : null}
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEventView }) {
  const actorName =
    typeof event.payload.actorName === 'string' && event.payload.actorName
      ? event.payload.actorName
      : 'Someone';
  const actorUsername =
    typeof event.payload.actorUsername === 'string' ? event.payload.actorUsername : '';
  const quote = activityQuote(event);

  return (
    <article
      className={cn(
        'grid grid-cols-[28px_1fr] items-start gap-x-[11px] gap-y-1 border-b border-border py-3 px-0.5',
        'tablet:grid-cols-[28px_1fr_68px] tablet:gap-x-3.5 tablet:px-1',
      )}
    >
      <span
        aria-hidden
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-[10px] font-semibold leading-none text-foreground"
      >
        {initials(actorName, actorUsername)}
      </span>
      <div className="flex min-w-0 flex-col gap-1 tablet:gap-1">
        <p className="text-[13.5px] leading-[1.45] text-foreground text-pretty">
          {activitySentence(event)}
        </p>
        {quote ? (
          <p className="line-clamp-4 rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px] leading-normal text-muted-foreground">
            {quote}
          </p>
        ) : null}
        <time
          dateTime={event.createdAt.toISOString()}
          className="text-[11.5px] text-subtle tabular-nums tablet:hidden"
        >
          {formatActivityClockTime(event.createdAt)}
        </time>
      </div>
      <time
        dateTime={event.createdAt.toISOString()}
        className="hidden text-[12px] text-subtle text-right tabular-nums tablet:block"
      >
        {formatActivityClockTime(event.createdAt)}
      </time>
    </article>
  );
}
