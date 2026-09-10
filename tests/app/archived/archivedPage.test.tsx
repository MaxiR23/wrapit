// tests/app/archived/archivedPage.test.tsx
//
// Tests for the /archived page projects list.
//
// Tested:
// - Renders Archived for a signed-in user
// - Does not wrap the page in the projects shell
// - Redirects when there is no session
//
// What is covered:
// - Authenticated render, unauthenticated redirect. Topbar search lives in
//   the authenticated layout; the phone search on the list remains on the
//   page.
//
// Run with: pnpm test:run tests/app/archived/archivedPage.test.tsx
//
// SEE: src/app/(app)/archived/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import { ProjectsSearchProvider } from '@/components/projects/ProjectsSearch';

const getSession = vi.fn();
const listArchivedProjectsForUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/archivedProjectsQuery', () => ({
  listArchivedProjectsForUser,
}));

vi.mock('@/actions/restoreArchivedCards', () => ({ restoreArchivedCards: vi.fn() }));
vi.mock('@/actions/rearchiveArchivedCards', () => ({ rearchiveArchivedCards: vi.fn() }));
vi.mock('@/actions/deleteArchivedCards', () => ({ deleteArchivedCards: vi.fn() }));
vi.mock('@/actions/restoreArchivedProjects', () => ({ restoreArchivedProjects: vi.fn() }));
vi.mock('@/actions/rearchiveArchivedProjects', () => ({ rearchiveArchivedProjects: vi.fn() }));
vi.mock('@/actions/deleteArchivedProject', () => ({ deleteArchivedProject: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: ArchivedProjectsPage } = await import('@/app/(app)/archived/page');

function renderPage(node: ReactNode) {
  return render(
    <OpenPanelProvider>
      <ProjectsSearchProvider>{node}</ProjectsSearchProvider>
    </OpenPanelProvider>,
  );
}

describe('Archived projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    listArchivedProjectsForUser.mockResolvedValue([]);
  });

  it('renders Archived for a signed-in user', async () => {
    renderPage(await ArchivedProjectsPage());

    expect(listArchivedProjectsForUser).toHaveBeenCalledWith('user-ada');
    expect(screen.getByRole('heading', { name: 'Archived' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('searchbox', { name: 'Search archived projects' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('No archived projects')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('redirects when there is no session', async () => {
    getSession.mockResolvedValue(null);

    await expect(ArchivedProjectsPage()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(redirect).toHaveBeenCalledWith('/sign-in');
  });
});
