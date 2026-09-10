'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ProjectsSearchContextValue = {
  query: string;
  setQuery: (query: string) => void;
};

const ProjectsSearchContext = createContext<ProjectsSearchContextValue | null>(null);

export function ProjectsSearchProvider({
  children,
  scope = 'projects',
}: {
  children: ReactNode;
  /** Screen key from searchScopeForPath. Null on /account: no query, setQuery is a no-op. */
  scope?: string | null;
}) {
  const [queries, setQueries] = useState<Record<string, string>>({});
  const query = scope === null ? '' : (queries[scope] ?? '');

  const setQuery = useCallback(
    (next: string) => {
      if (scope === null) return;
      setQueries((current) => (current[scope] === next ? current : { ...current, [scope]: next }));
    },
    [scope],
  );

  const value = useMemo(() => ({ query, setQuery }), [query, setQuery]);

  return <ProjectsSearchContext.Provider value={value}>{children}</ProjectsSearchContext.Provider>;
}

export function useProjectsSearch(): ProjectsSearchContextValue {
  const context = useContext(ProjectsSearchContext);
  if (!context) {
    throw new Error('useProjectsSearch must be used within ProjectsSearchProvider');
  }
  return context;
}
