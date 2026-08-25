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

export type OpenPanelId = 'notifications' | 'account' | 'filters' | 'visibility' | 'member' | null;

type OpenPanelContextValue = {
  openPanel: OpenPanelId;
  setOpenPanel: (id: OpenPanelId) => void;
};

const OpenPanelContext = createContext<OpenPanelContextValue | null>(null);

export function OpenPanelProvider({ children }: { children: ReactNode }) {
  const [openPanel, setOpenPanelState] = useState<OpenPanelId>(null);
  const setOpenPanel = useCallback((id: OpenPanelId) => {
    setOpenPanelState(id);
  }, []);
  const value = useMemo(() => ({ openPanel, setOpenPanel }), [openPanel, setOpenPanel]);

  useEffect(() => {
    if (openPanel === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenPanel(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openPanel, setOpenPanel]);

  return <OpenPanelContext.Provider value={value}>{children}</OpenPanelContext.Provider>;
}

export function useOpenPanel() {
  const context = useContext(OpenPanelContext);
  if (!context) {
    throw new Error('useOpenPanel must be used within OpenPanelProvider');
  }
  return context;
}
