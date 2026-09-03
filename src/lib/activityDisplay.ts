import type {
  ActivityEventListItem,
  ActivityEventType,
  ActivityPayload,
  ActivityPayloadFor,
} from '@/lib/activity';
import { parseActivityPayload } from '@/lib/activity';
import { activityCopy, type ActivityCopy } from '@/lib/activityCopy';
import { cardDueLabel, dueDateFromCalendarDay, instantFromZonedWallTime } from '@/lib/cardDue';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityEventView = {
  id: string;
  type: ActivityEventType;
  actorId: string | null;
  createdAt: Date;
  payload: Record<string, unknown>;
  valid: boolean;
};

export type ActivityDayGroup = {
  label: string;
  items: ActivityEventView[];
};

export function activityEventViewFromItem(item: ActivityEventListItem): ActivityEventView {
  return {
    id: item.id,
    type: item.type,
    actorId: item.actorId,
    createdAt: new Date(item.createdAt),
    payload: item.payload,
    valid: item.valid,
  };
}

export function activityCardId(payload: Record<string, unknown>): string | null {
  return typeof payload.cardId === 'string' && payload.cardId.length > 0 ? payload.cardId : null;
}

function actorNameOf(payload: Record<string, unknown>): string {
  return typeof payload.actorName === 'string' && payload.actorName ? payload.actorName : 'Someone';
}

function localDayMs(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatActivityClockTime(date: Date, locale = activityCopy.locale): string {
  return date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * The due date an event recorded, read back through the shared formatter. The
 * payload keeps wall parts plus a zone, so the instant is rebuilt here and then
 * converted into the viewer's zone.
 */
export function formatActivityDue(
  due: { dueDate: string; dueTime?: string | null; dueTimeZone?: string | null },
  viewerTimeZone: string | null = null,
  locale = activityCopy.locale,
): { label: string; zoneNote: string | null } | null {
  const isMoment = due.dueTime != null && due.dueTimeZone != null;
  const instant = isMoment
    ? instantFromZonedWallTime(due.dueDate, due.dueTime as string, due.dueTimeZone as string)
    : dueDateFromCalendarDay(due.dueDate);
  if (!instant) return null;

  const label = cardDueLabel(
    { dueDate: instant, dueTimeZone: isMoment ? (due.dueTimeZone as string) : null },
    { style: 'long', locale, viewerTimeZone },
  );
  return { label: label.text, zoneNote: label.zoneNote };
}

export function formatActivityDayLabel(
  date: Date,
  now: Date,
  copy: ActivityCopy = activityCopy,
): string {
  const diff = Math.round((localDayMs(now) - localDayMs(date)) / DAY_MS);
  if (diff === 0) return copy.today;
  if (diff === 1) return copy.yesterday;
  if (diff > 1 && diff < 7) {
    return date.toLocaleDateString(copy.locale, { weekday: 'long' });
  }
  return date.toLocaleDateString(copy.locale, { day: 'numeric', month: 'short' });
}

function sentenceFor(
  type: ActivityEventType,
  payload: ActivityPayload,
  copy: ActivityCopy,
  viewerTimeZone: string | null,
): string {
  switch (type) {
    case 'CARD_CREATED': {
      const data = payload as ActivityPayloadFor<'CARD_CREATED'>;
      return copy.cardCreated({
        actorName: data.actorName,
        cardTitle: data.cardTitle,
        columnTitle: data.columnTitle,
      });
    }
    case 'CARD_MOVED': {
      const data = payload as ActivityPayloadFor<'CARD_MOVED'>;
      return copy.cardMoved({
        actorName: data.actorName,
        cardTitle: data.cardTitle,
        fromColumnTitle: data.fromColumnTitle,
        toColumnTitle: data.toColumnTitle,
      });
    }
    case 'CARD_ARCHIVED': {
      const data = payload as ActivityPayloadFor<'CARD_ARCHIVED'>;
      return copy.cardArchived({ actorName: data.actorName, cardTitle: data.cardTitle });
    }
    case 'CARD_RESTORED': {
      const data = payload as ActivityPayloadFor<'CARD_RESTORED'>;
      return copy.cardRestored({ actorName: data.actorName, cardTitle: data.cardTitle });
    }
    case 'CARD_DELETED': {
      const data = payload as ActivityPayloadFor<'CARD_DELETED'>;
      return copy.cardDeleted({ actorName: data.actorName, cardTitle: data.cardTitle });
    }
    case 'ASSIGNEES_CHANGED': {
      const data = payload as ActivityPayloadFor<'ASSIGNEES_CHANGED'>;
      return copy.assigneesChanged({
        actorName: data.actorName,
        cardTitle: data.cardTitle,
        assigneeNames: data.assignees.map((assignee) => assignee.name),
      });
    }
    case 'LABEL_CHANGED': {
      const data = payload as ActivityPayloadFor<'LABEL_CHANGED'>;
      return copy.labelChanged({
        actorName: data.actorName,
        cardTitle: data.cardTitle,
        labelName: data.labelName,
      });
    }
    case 'DUE_DATE_CHANGED': {
      const data = payload as ActivityPayloadFor<'DUE_DATE_CHANGED'>;
      const due = data.dueDate
        ? formatActivityDue(
            {
              dueDate: data.dueDate,
              dueTime: data.dueTime,
              dueTimeZone: data.dueTimeZone,
            },
            viewerTimeZone,
            copy.locale,
          )
        : null;
      return copy.dueDateChanged({
        actorName: data.actorName,
        cardTitle: data.cardTitle,
        dueDateLabel: due?.label ?? null,
        zoneNote: due?.zoneNote ?? null,
      });
    }
    case 'COMMENT_ADDED': {
      const data = payload as ActivityPayloadFor<'COMMENT_ADDED'>;
      return copy.commentAdded({ actorName: data.actorName, cardTitle: data.cardTitle });
    }
    case 'PROJECT_CREATED': {
      const data = payload as ActivityPayloadFor<'PROJECT_CREATED'>;
      return copy.projectCreated({ actorName: data.actorName, projectTitle: data.projectTitle });
    }
    case 'MEMBER_ADDED': {
      const data = payload as ActivityPayloadFor<'MEMBER_ADDED'>;
      return copy.memberAdded({ actorName: data.actorName });
    }
    case 'MEMBER_REMOVED': {
      const data = payload as ActivityPayloadFor<'MEMBER_REMOVED'>;
      return copy.memberRemoved({ actorName: data.actorName, memberName: data.memberName });
    }
    case 'OWNERSHIP_TRANSFERRED': {
      const data = payload as ActivityPayloadFor<'OWNERSHIP_TRANSFERRED'>;
      return copy.ownershipTransferred({ actorName: data.actorName, memberName: data.memberName });
    }
    case 'MEMBER_LEFT': {
      const data = payload as ActivityPayloadFor<'MEMBER_LEFT'>;
      return copy.memberLeft({ actorName: data.actorName });
    }
    case 'MEMBER_PROMOTED': {
      const data = payload as ActivityPayloadFor<'MEMBER_PROMOTED'>;
      return copy.memberPromoted({ actorName: data.actorName, memberName: data.memberName });
    }
    case 'MEMBER_DEMOTED': {
      const data = payload as ActivityPayloadFor<'MEMBER_DEMOTED'>;
      return copy.memberDemoted({ actorName: data.actorName, memberName: data.memberName });
    }
    case 'PROJECT_ARCHIVED': {
      const data = payload as ActivityPayloadFor<'PROJECT_ARCHIVED'>;
      return copy.projectArchived({ actorName: data.actorName, projectTitle: data.projectTitle });
    }
    case 'PROJECT_RESTORED': {
      const data = payload as ActivityPayloadFor<'PROJECT_RESTORED'>;
      return copy.projectRestored({ actorName: data.actorName, projectTitle: data.projectTitle });
    }
    case 'PROJECT_DELETED': {
      const data = payload as ActivityPayloadFor<'PROJECT_DELETED'>;
      return copy.projectDeleted({ actorName: data.actorName, projectTitle: data.projectTitle });
    }
  }
}

export function activitySentence(
  event: ActivityEventView,
  copy: ActivityCopy = activityCopy,
  viewerTimeZone: string | null = null,
): string {
  if (!event.valid) {
    return copy.fallback({ actorName: actorNameOf(event.payload) });
  }
  const parsed = parseActivityPayload(event.type, event.payload);
  if (!parsed.success) {
    return copy.fallback({ actorName: actorNameOf(event.payload) });
  }
  return sentenceFor(event.type, parsed.data, copy, viewerTimeZone);
}

export function activityQuote(event: ActivityEventView): string | null {
  if (event.type !== 'COMMENT_ADDED' || !event.valid) return null;
  const parsed = parseActivityPayload(event.type, event.payload);
  if (!parsed.success) return null;
  const data = parsed.data as ActivityPayloadFor<'COMMENT_ADDED'>;
  return data.body;
}

function canCollapse(newer: ActivityEventView, older: ActivityEventView): boolean {
  const cardId = activityCardId(newer.payload);
  if (cardId == null) return false;
  return (
    newer.type === older.type &&
    newer.actorId === older.actorId &&
    activityCardId(older.payload) === cardId
  );
}

function mergeCollapsed(newer: ActivityEventView, older: ActivityEventView): ActivityEventView {
  if (newer.type !== 'CARD_MOVED' || older.type !== 'CARD_MOVED') {
    return newer;
  }
  return {
    ...newer,
    payload: {
      ...newer.payload,
      fromColumnId: older.payload.fromColumnId,
      fromColumnTitle: older.payload.fromColumnTitle,
    },
  };
}

export function collapseActivityEvents(events: ActivityEventView[]): ActivityEventView[] {
  const sorted = [...events].sort((left, right) => {
    const byTime = right.createdAt.getTime() - left.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return right.id < left.id ? -1 : right.id > left.id ? 1 : 0;
  });

  const collapsed: ActivityEventView[] = [];
  for (const event of sorted) {
    const previous = collapsed[collapsed.length - 1];
    if (previous && canCollapse(previous, event)) {
      collapsed[collapsed.length - 1] = mergeCollapsed(previous, event);
    } else {
      collapsed.push(event);
    }
  }
  return collapsed;
}

export function groupActivityByDay(
  events: ActivityEventView[],
  now: Date,
  copy: ActivityCopy = activityCopy,
): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = [];
  for (const event of events) {
    const key = localDayMs(event.createdAt);
    const last = groups[groups.length - 1];
    const lastKey = last?.items[0] ? localDayMs(last.items[0].createdAt) : null;
    if (last && lastKey === key) {
      last.items.push(event);
    } else {
      groups.push({
        label: formatActivityDayLabel(event.createdAt, now, copy),
        items: [event],
      });
    }
  }
  return groups;
}
