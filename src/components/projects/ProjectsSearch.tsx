'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ProjectsSearchContextValue = {
  query: string;
  setQuery: (query: string) => void;
};

const ProjectsSearchContext = createContext<ProjectsSearchContextValue | null>(null);

export function ProjectsSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const value = useMemo(() => ({ query, setQuery }), [query]);

  return <ProjectsSearchContext.Provider value={value}>{children}</ProjectsSearchContext.Provider>;
}

export function useProjectsSearch(): ProjectsSearchContextValue {
  const context = useContext(ProjectsSearchContext);
  if (!context) {
    throw new Error('useProjectsSearch must be used within ProjectsSearchProvider');
  }
  return context;
}
