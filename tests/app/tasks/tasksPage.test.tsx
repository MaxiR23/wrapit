// tests/app/tasks/tasksPage.test.tsx
//
// Tests for the /tasks page list.
//
// Tested:
// - Renders My tasks for a signed-in user
// - Does not wrap the page in the projects shell
// - Redirects when there is no session
//
// What is covered:
// - Authenticated render, unauthenticated redirect. Topbar search lives in
//   the authenticated layout.
//
// Run with: pnpm test:run tests/app/tasks/tasksPage.test.tsx
//
// SEE: src/app/(app)/tasks/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import { ProjectsSearchProvider } from '@/components/projects/ProjectsSearch';

const getSession = vi.fn();
const listMyTasksForUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/myTasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/myTasks')>();
  return {
    ...actual,
    listMyTasksForUser,
  };
});

vi.mock('@/actions/createCard', () => ({ createCard: vi.fn() }));
vi.mock('@/actions/setCardCompleted', () => ({ setCardCompleted: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: MyTasksPage } = await import('@/app/(app)/tasks/page');

function renderPage(node: ReactNode) {
  return render(
    <OpenPanelProvider>
      <ProjectsSearchProvider>{node}</ProjectsSearchProvider>
    </OpenPanelProvider>,
  );
}

describe('My tasks page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    listMyTasksForUser.mockResolvedValue({
      tasks: [],
      createProjects: [],
      openCount: 0,
    });
  });

  it('renders My tasks for a signed-in user', async () => {
    renderPage(await MyTasksPage());

    expect(listMyTasksForUser).toHaveBeenCalledWith(expect.anything(), 'user-ada');
    expect(screen.getByRole('heading', { name: 'My tasks' })).toBeInTheDocument();
    expect(screen.getByText('Nothing pending here')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('redirects when there is no session', async () => {
    getSession.mockResolvedValue(null);

    await expect(MyTasksPage()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(redirect).toHaveBeenCalledWith('/sign-in');
  });
});
