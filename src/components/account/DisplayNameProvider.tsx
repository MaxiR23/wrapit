'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ProjectsShellUser } from '@/components/projects/shell';
import { initials } from '@/lib/initials';

type DisplayNameContextValue = {
  name: string;
  username: string;
  initials: string;
  setName: (name: string) => void;
};

const DisplayNameContext = createContext<DisplayNameContextValue | null>(null);

export function DisplayNameProvider({
  initialName,
  username,
  children,
}: {
  initialName: string;
  username: string;
  children: ReactNode;
}) {
  const [name, setNameState] = useState(initialName);
  const setName = useCallback((next: string) => {
    setNameState(next);
  }, []);
  const value = useMemo(
    () => ({ name, username, initials: initials(name, username), setName }),
    [name, username, setName],
  );

  return <DisplayNameContext.Provider value={value}>{children}</DisplayNameContext.Provider>;
}

/** Reads the live display name and initials. Falls back when the provider is not mounted. */
export function useDisplayName(fallbackName = '', fallbackUsername = ''): DisplayNameContextValue {
  const context = useContext(DisplayNameContext);
  if (context) return context;
  return {
    name: fallbackName,
    username: fallbackUsername,
    initials: initials(fallbackName, fallbackUsername),
    setName: () => {},
  };
}

/** Session user with the live display name and initials derived from it. */
export function useLiveShellUser(
  user: ProjectsShellUser,
): ProjectsShellUser & { initials: string } {
  const { name, initials: liveInitials } = useDisplayName(user.name, user.username);
  return {
    ...user,
    name,
    initials: liveInitials,
  };
}
