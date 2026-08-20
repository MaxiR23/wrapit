'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type VisibilityMenuKey = string | null;

type VisibilityMenuContextValue = {
  openKey: VisibilityMenuKey;
  setOpenKey: (key: VisibilityMenuKey) => void;
};

const VisibilityMenuContext = createContext<VisibilityMenuContextValue | null>(null);

export function VisibilityMenuProvider({ children }: { children: ReactNode }) {
  const [openKey, setOpenKeyState] = useState<VisibilityMenuKey>(null);
  const setOpenKey = useCallback((key: VisibilityMenuKey) => {
    setOpenKeyState(key);
  }, []);
  const value = useMemo(() => ({ openKey, setOpenKey }), [openKey, setOpenKey]);

  return <VisibilityMenuContext.Provider value={value}>{children}</VisibilityMenuContext.Provider>;
}

export function useVisibilityMenu() {
  const context = useContext(VisibilityMenuContext);
  if (!context) {
    throw new Error('useVisibilityMenu must be used within VisibilityMenuProvider');
  }
  return context;
}
