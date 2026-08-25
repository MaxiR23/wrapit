'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

const ViewerTimeZoneContext = createContext<string | null>(null);

/** The zone never changes while the tab is open, so there is nothing to watch. */
function subscribe(): () => void {
  return () => {};
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function noTimeZone(): null {
  return null;
}

/**
 * Publishes the browser's IANA zone to everything that renders a due moment.
 *
 * The server has no way to know the viewer's zone, so it reads null there and
 * consumers fall back to the zone a due date was set in, which is data. React
 * swaps in the real zone right after hydration, so nothing mismatches and any
 * component mounted later still sees it on its first render.
 */
export function ViewerTimeZoneProvider({ children }: { children: ReactNode }) {
  const timeZone = useSyncExternalStore(subscribe, browserTimeZone, noTimeZone);

  return (
    <ViewerTimeZoneContext.Provider value={timeZone}>{children}</ViewerTimeZoneContext.Provider>
  );
}

/** The viewer's IANA zone, or null when it is not known yet. */
export function useViewerTimeZone(): string | null {
  return useContext(ViewerTimeZoneContext);
}
