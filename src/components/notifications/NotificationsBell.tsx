'use client';

import { Bell } from 'lucide-react';

import {
  NotificationsPanelContent,
  notificationsPanelClassName,
} from '@/components/notifications/NotificationsPanelContent';
import { useNotifications } from '@/components/notifications/NotificationsProvider';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

export function NotificationsBell({
  className,
  iconClassName,
  iconStrokeWidth = 1.8,
}: {
  className?: string;
  iconClassName?: string;
  iconStrokeWidth?: number;
}) {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const { unreadCount, refresh } = useNotifications();
  const open = openPanel === 'notifications';
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={() => {
        if (open) {
          setOpenPanel(null);
          return;
        }
        setOpenPanel('notifications');
        void refresh();
      }}
      className={cn(
        shellFocusClassName,
        'relative inline-flex items-center justify-center',
        className,
      )}
    >
      <Bell className={iconClassName} strokeWidth={iconStrokeWidth} />
      {unreadCount > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-foreground px-1 text-[10px] font-semibold leading-4 text-background">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function NotificationsPanel({
  kind,
  onClose,
}: {
  kind: 'popover' | 'sheet';
  onClose?: () => void;
}) {
  const { items, markRead, markAllRead, accept, reject } = useNotifications();

  return (
    <div
      role="dialog"
      aria-modal={kind === 'sheet' ? true : undefined}
      aria-label="Notifications"
      className={notificationsPanelClassName(kind)}
    >
      <NotificationsPanelContent
        items={items}
        onMarkRead={(id) => void markRead(id)}
        onMarkAllRead={() => void markAllRead()}
        onAccept={(invitationId) => void accept(invitationId)}
        onReject={(invitationId) => void reject(invitationId)}
        onClose={onClose}
      />
    </div>
  );
}

export function NotificationsPopover() {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const open = openPanel === 'notifications';

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 hidden md:block"
        aria-hidden="true"
        onClick={() => setOpenPanel(null)}
      />
      <NotificationsPanel kind="popover" />
    </>
  );
}

export function NotificationsSheet() {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const open = openPanel === 'notifications';

  if (!open) return null;

  return <NotificationsPanel kind="sheet" onClose={() => setOpenPanel(null)} />;
}
