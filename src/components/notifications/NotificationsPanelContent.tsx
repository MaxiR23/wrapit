'use client';

import { X } from 'lucide-react';

import { initials } from '@/lib/initials';
import type { NotificationListItem } from '@/lib/notifications';
import { formatRelativeTime } from '@/lib/relativeTime';

export function NotificationsPanelContent({
  items,
  onMarkRead,
  onMarkAllRead,
  onAccept,
  onReject,
  onClose,
}: {
  items: NotificationListItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onAccept: (invitationId: string) => void;
  onReject: (invitationId: string) => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="mr-auto text-[15px] font-semibold tracking-[-0.01em]">Notifications</h2>
        <button
          type="button"
          className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
          onClick={onMarkAllRead}
        >
          Mark all as read
        </button>
        {onClose ? (
          <button
            type="button"
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground tablet:hidden"
            onClick={onClose}
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13.5px] text-muted-foreground">
          No notifications
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto">
          {items.map((item) => (
            <NotificationItem
              key={item.id}
              item={item}
              onMarkRead={onMarkRead}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationItem({
  item,
  onMarkRead,
  onAccept,
  onReject,
}: {
  item: NotificationListItem;
  onMarkRead: (id: string) => void;
  onAccept: (invitationId: string) => void;
  onReject: (invitationId: string) => void;
}) {
  const showActions = item.type === 'INVITATION_RECEIVED' && item.invitationId;
  const actorInitials = initials(item.actorName, item.actorUsername);

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex gap-2.5 px-4 py-3">
        <span className="mt-1.5 flex size-2 shrink-0 items-center justify-center">
          {!item.read ? (
            <span className="size-1.5 rounded-full bg-foreground" aria-label="Unread" />
          ) : null}
        </span>
        <button
          type="button"
          className="flex min-w-0 flex-1 gap-2.5 text-left"
          onClick={() => onMarkRead(item.id)}
        >
          <span
            className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border border-border-strong bg-card text-[10px] font-semibold leading-none"
            aria-hidden="true"
          >
            {actorInitials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-snug text-foreground">{item.message}</span>
            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
              {formatRelativeTime(new Date(item.createdAt))}
            </span>
          </span>
        </button>
      </div>
      {showActions ? (
        <div className="flex gap-2 pr-4 pb-3 pl-[52px]">
          <button
            type="button"
            className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground"
            onClick={() => onAccept(item.invitationId!)}
          >
            Accept
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => onReject(item.invitationId!)}
          >
            Decline
          </button>
        </div>
      ) : null}
    </li>
  );
}
