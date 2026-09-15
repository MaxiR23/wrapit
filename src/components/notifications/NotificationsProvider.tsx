'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import { acceptInvitation } from '@/actions/acceptInvitation';
import { listNotifications } from '@/actions/listNotifications';
import { markAllNotificationsRead } from '@/actions/markAllNotificationsRead';
import { markNotificationRead } from '@/actions/markNotificationRead';
import { rejectInvitation } from '@/actions/rejectInvitation';
import type { NotificationListItem } from '@/lib/notifications';

type NotificationsContextValue = {
  items: NotificationListItem[];
  unreadCount: number;
  listReady: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  accept: (invitationId: string) => Promise<void>;
  reject: (invitationId: string) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({
  children,
  initialUnreadCount = 0,
}: {
  children: ReactNode;
  initialUnreadCount?: number;
}) {
  const router = useRouter();
  const listEpochRef = useRef(0);
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [listReady, setListReady] = useState(false);
  const [seededCount, setSeededCount] = useState(initialUnreadCount);
  if (initialUnreadCount !== seededCount) {
    setSeededCount(initialUnreadCount);
    setUnreadCount(initialUnreadCount);
  }

  function invalidateInFlightList() {
    listEpochRef.current += 1;
  }

  const refresh = useCallback(async () => {
    const epoch = ++listEpochRef.current;
    setListReady(false);
    const result = await listNotifications();
    if (epoch !== listEpochRef.current) return;
    if ('data' in result) {
      setItems(result.data.items);
      setUnreadCount(result.data.unreadCount);
    }
    setListReady(true);
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      invalidateInFlightList();
      setListReady(true);
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      setUnreadCount((current) => {
        const target = items.find((item) => item.id === id);
        if (!target || target.read) return current;
        return Math.max(0, current - 1);
      });
      const result = await markNotificationRead(id);
      if ('error' in result) {
        await refresh();
      }
    },
    [items, refresh],
  );

  const markAllRead = useCallback(async () => {
    invalidateInFlightList();
    setListReady(true);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    const result = await markAllNotificationsRead();
    if ('error' in result) {
      await refresh();
    }
  }, [refresh]);

  const accept = useCallback(
    async (invitationId: string) => {
      invalidateInFlightList();
      setListReady(true);
      const removed = items.filter(
        (item) => item.type === 'INVITATION_RECEIVED' && item.invitationId === invitationId,
      );
      setItems((current) =>
        current.filter(
          (item) => !(item.type === 'INVITATION_RECEIVED' && item.invitationId === invitationId),
        ),
      );
      const unreadRemoved = removed.filter((item) => !item.read).length;
      if (unreadRemoved > 0) {
        setUnreadCount((count) => Math.max(0, count - unreadRemoved));
      }
      const result = await acceptInvitation(invitationId);
      if ('error' in result) {
        await refresh();
        return;
      }
      router.refresh();
    },
    [items, refresh, router],
  );

  const reject = useCallback(
    async (invitationId: string) => {
      invalidateInFlightList();
      setListReady(true);
      const removed = items.filter(
        (item) => item.type === 'INVITATION_RECEIVED' && item.invitationId === invitationId,
      );
      setItems((current) =>
        current.filter(
          (item) => !(item.type === 'INVITATION_RECEIVED' && item.invitationId === invitationId),
        ),
      );
      const unreadRemoved = removed.filter((item) => !item.read).length;
      if (unreadRemoved > 0) {
        setUnreadCount((count) => Math.max(0, count - unreadRemoved));
      }
      const result = await rejectInvitation(invitationId);
      if ('error' in result) {
        await refresh();
      }
    },
    [items, refresh],
  );

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      listReady,
      refresh,
      markRead,
      markAllRead,
      accept,
      reject,
    }),
    [items, unreadCount, listReady, refresh, markRead, markAllRead, accept, reject],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
