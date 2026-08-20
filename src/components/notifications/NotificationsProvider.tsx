'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import { acceptInvitation } from '@/actions/acceptInvitation';
import { listNotifications } from '@/actions/listNotifications';
import { markAllNotificationsRead } from '@/actions/markAllNotificationsRead';
import { markNotificationRead } from '@/actions/markNotificationRead';
import { rejectInvitation } from '@/actions/rejectInvitation';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import type { NotificationListItem } from '@/lib/notifications';

type NotificationsContextValue = {
  items: NotificationListItem[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  accept: (invitationId: string) => Promise<void>;
  reject: (invitationId: string) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({
  children,
  initialItems = [],
}: {
  children: ReactNode;
  initialItems?: NotificationListItem[];
}) {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const router = useRouter();
  const [items, setItems] = useState<NotificationListItem[]>(initialItems);

  const unreadCount = items.filter((item) => !item.read).length;

  const refresh = useCallback(async () => {
    const result = await listNotifications();
    if ('data' in result) {
      setItems(result.data.items);
    }
  }, []);

  useEffect(() => {
    if (openPanel !== 'notifications') return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenPanel(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openPanel, setOpenPanel]);

  const markRead = useCallback(
    async (id: string) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      const result = await markNotificationRead(id);
      if ('error' in result) {
        await refresh();
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    const result = await markAllNotificationsRead();
    if ('error' in result) {
      await refresh();
    }
  }, [refresh]);

  const accept = useCallback(
    async (invitationId: string) => {
      setItems((current) =>
        current.filter(
          (item) => !(item.type === 'INVITATION_RECEIVED' && item.invitationId === invitationId),
        ),
      );
      const result = await acceptInvitation(invitationId);
      if ('error' in result) {
        await refresh();
        return;
      }
      router.refresh();
    },
    [refresh, router],
  );

  const reject = useCallback(
    async (invitationId: string) => {
      setItems((current) =>
        current.filter(
          (item) => !(item.type === 'INVITATION_RECEIVED' && item.invitationId === invitationId),
        ),
      );
      const result = await rejectInvitation(invitationId);
      if ('error' in result) {
        await refresh();
      }
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ items, unreadCount, refresh, markRead, markAllRead, accept, reject }),
    [items, unreadCount, refresh, markRead, markAllRead, accept, reject],
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
