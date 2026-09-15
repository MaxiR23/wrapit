// tests/app/projects/archivedPage.test.tsx
//
// Tests for the project archived-tasks page.
//
// Tested:
// - Passes canAdminister from getArchivedCardsForUser
// - MEMBER restore and delete stay disabled; OWNER/ADMIN stay enabled
//
// What is covered:
// - Viewer role resolved in the domain layer, same access behaviour as the
//   previous page-level membership read
//
// Run with: pnpm test:run tests/app/projects/archivedPage.test.tsx
//
// SEE: src/app/(app)/projects/[projectId]/archived/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import { ProjectsSearchProvider } from '@/components/projects/ProjectsSearch';
import type { ArchivedTask } from '@/lib/archived';

const getSession = vi.fn();
const getArchivedCardsForUser = vi.fn();
const getArchivedProjectForUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/archivedQuery', () => ({
  getArchivedCardsForUser,
}));

vi.mock('@/lib/projects', () => ({
  getArchivedProjectForUser,
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
  notFound,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: ProjectArchivedPage } =
  await import('@/app/(app)/projects/[projectId]/archived/page');

const card: ArchivedTask = {
  id: 'card-1',
  title: 'Write tests',
  code: 'SB-1',
  description: null,
  archivedAt: new Date('2026-08-09T10:00:00.000Z'),
  archivedBy: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
  column: { id: 'col-todo', title: 'To do' },
  label: null,
  assignees: [],
  subtasks: [],
  comments: [],
};

function renderPage(node: ReactNode) {
  return render(
    <OpenPanelProvider>
      <ProjectsSearchProvider>{node}</ProjectsSearchProvider>
    </OpenPanelProvider>,
  );
}

function pageProps(projectId: string) {
  return { params: Promise.resolve({ projectId }) };
}

describe('Project archived page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    getArchivedProjectForUser.mockResolvedValue(null);
  });

  it('enables restore when getArchivedCardsForUser marks the viewer as admin', async () => {
    getArchivedCardsForUser.mockResolvedValue({
      id: 'project-1',
      title: 'Sprint board',
      cards: [card],
      totalCount: 1,
      canAdminister: true,
    });

    renderPage(await ProjectArchivedPage(pageProps('project-1')));

    expect(getArchivedCardsForUser).toHaveBeenCalledWith('project-1', 'user-ada');
    expect(screen.getAllByRole('button', { name: 'Restore' })[0]).toBeEnabled();
    expect(screen.getAllByRole('button', { name: 'Delete permanently' })[0]).toBeEnabled();
  });

  it('disables restore and delete when getArchivedCardsForUser marks the viewer as a member', async () => {
    getArchivedCardsForUser.mockResolvedValue({
      id: 'project-1',
      title: 'Sprint board',
      cards: [card],
      totalCount: 1,
      canAdminister: false,
    });

    renderPage(await ProjectArchivedPage(pageProps('project-1')));

    expect(getArchivedCardsForUser).toHaveBeenCalledWith('project-1', 'user-ada');
    for (const button of screen.getAllByRole('button', { name: 'Restore' })) {
      expect(button).toBeDisabled();
    }
    for (const button of screen.getAllByRole('button', { name: 'Delete permanently' })) {
      expect(button).toBeDisabled();
    }
  });
});
