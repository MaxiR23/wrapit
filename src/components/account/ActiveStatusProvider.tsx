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

import { parseUserStatusTone, type UserStatusTone } from '@/lib/userStatus';

export type ActiveStatusValue = {
  id: string;
  name: string;
  color: UserStatusTone;
};

type ActiveStatusContextValue = {
  status: ActiveStatusValue;
  setActive: (next: ActiveStatusValue) => void;
  getActive: () => ActiveStatusValue;
};

const ActiveStatusContext = createContext<ActiveStatusContextValue | null>(null);

function toActiveStatus(next: ActiveStatusValue): ActiveStatusValue {
  return {
    id: next.id,
    name: next.name,
    color: parseUserStatusTone(next.color),
  };
}

export function ActiveStatusProvider({
  initial,
  children,
}: {
  initial: ActiveStatusValue;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<ActiveStatusValue>(() => toActiveStatus(initial));
  const statusRef = useRef(status);
  const setActive = useCallback((next: ActiveStatusValue) => {
    const normalized = toActiveStatus(next);
    statusRef.current = normalized;
    setStatus(normalized);
  }, []);
  const getActive = useCallback(() => statusRef.current, []);
  const value = useMemo(() => ({ status, setActive, getActive }), [status, setActive, getActive]);

  return <ActiveStatusContext.Provider value={value}>{children}</ActiveStatusContext.Provider>;
}

export function useActiveStatus(fallback?: ActiveStatusValue): ActiveStatusContextValue {
  const context = useContext(ActiveStatusContext);
  if (context) return context;
  const status = fallback ?? { id: '', name: '', color: 'green' };
  return { status, setActive: () => {}, getActive: () => status };
}
