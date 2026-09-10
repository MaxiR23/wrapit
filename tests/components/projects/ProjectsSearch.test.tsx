// tests/components/projects/ProjectsSearch.test.tsx
//
// Tests for screen-scoped search on the authenticated shell provider.
//
// Tested:
// - A query typed on one screen does not filter an unrelated screen
// - One board query does not apply to a different project
// - Opening a project from the filtered grid and coming back keeps the query
// - /account never has an active query, and setQuery there is ignored
//
// What is covered:
// - Per-screen query map while the provider stays mounted. jsdom cannot
//   prove a real Next navigation keeps that provider alive.
//
// Run with: pnpm test:run tests/components/projects/ProjectsSearch.test.tsx
//
// SEE: src/components/projects/ProjectsSearch.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { ProjectsSearchProvider, useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { searchScopeForPath } from '@/components/projects/searchScope';

function Probe() {
  const { query, setQuery } = useProjectsSearch();
  return (
    <div>
      <output aria-label="Search query">{query}</output>
      <button type="button" onClick={() => setQuery('sprint')}>
        Type sprint
      </button>
      <button type="button" onClick={() => setQuery('armed')}>
        Type armed
      </button>
    </div>
  );
}

function searchTree(path: string): ReactElement {
  return (
    <ProjectsSearchProvider scope={searchScopeForPath(path)}>
      <Probe />
    </ProjectsSearchProvider>
  );
}

function renderSearch(path: string) {
  return render(searchTree(path));
}

describe('ProjectsSearchProvider', () => {
  it('does not apply a projects query to a board, tasks, or archived', async () => {
    const user = userEvent.setup();
    const view = renderSearch('/projects');

    await user.click(screen.getByRole('button', { name: 'Type sprint' }));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('sprint');

    view.rerender(searchTree('/projects/project-1'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');

    view.rerender(searchTree('/tasks'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');

    view.rerender(searchTree('/archived'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');
  });

  it('does not reuse one board query on a different project', async () => {
    const user = userEvent.setup();
    const view = renderSearch('/projects/project-1');

    await user.click(screen.getByRole('button', { name: 'Type sprint' }));

    view.rerender(searchTree('/projects/project-2'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');

    view.rerender(searchTree('/projects/project-1'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('sprint');
  });

  it('keeps a grid query after opening a project and coming back', async () => {
    const user = userEvent.setup();
    const view = renderSearch('/projects');

    await user.click(screen.getByRole('button', { name: 'Type sprint' }));

    view.rerender(searchTree('/projects/project-1'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');

    view.rerender(searchTree('/projects'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('sprint');
  });

  it('never exposes a query on /account and ignores setQuery there', async () => {
    const user = userEvent.setup();
    const view = renderSearch('/projects');

    await user.click(screen.getByRole('button', { name: 'Type sprint' }));

    view.rerender(searchTree('/account'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');

    await user.click(screen.getByRole('button', { name: 'Type armed' }));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');

    view.rerender(searchTree('/tasks'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');

    view.rerender(searchTree('/projects'));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('sprint');
  });
});
