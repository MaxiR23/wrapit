// tests/app/request-memo.test.tsx
//
// Tests that the authenticated layout and /tasks share request-memoized reads.
//
// Tested:
// - Layout plus the tasks page resolve the session once
// - Layout plus the tasks page load assigned context once
//
// What is covered:
// - Shared React.cache lookups on one composed render. jsdom's client React
//   makes cache() a no-op, so this file installs a request-scoped stand-in.
//   jsdom cannot prove Next's real request scope.
//
// Run with: pnpm test:run tests/app/request-memo.test.tsx
//
// SEE: src/app/(app)/layout.tsx, src/app/(app)/tasks/page.tsx

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { resetRequestCache } from '../helpers/requestCache';
import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const getSessionFromAuth = vi.fn();
const db = createPrismaFake();

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const { cache } = await import('../helpers/requestCache');
  return { ...actual, cache };
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: getSessionFromAuth } },
}));

vi.mock('@/lib/prisma', () => ({ prisma: db }));

vi.mock('@/lib/authClient', () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock('@/actions/listNotifications', () => ({
  listNotifications: vi.fn(async () => ({ data: { items: [], unreadCount: 0 } })),
}));
vi.mock('@/actions/markNotificationRead', () => ({ markNotificationRead: vi.fn() }));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead: vi.fn() }));
vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation: vi.fn() }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation: vi.fn() }));
vi.mock('@/actions/createCard', () => ({ createCard: vi.fn() }));
vi.mock('@/actions/setCardCompleted', () => ({ setCardCompleted: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/tasks',
}));

const { default: AppLayout } = await import('@/app/(app)/layout');
const { default: MyTasksPage } = await import('@/app/(app)/tasks/page');

describe('authenticated request memo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    resetRequestCache();
    getSessionFromAuth.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
  });

  it('resolves the session once and loads assigned context once for /tasks', async () => {
    const project = await seedAccessibleProject(db, { title: 'Sprint board', userId: 'user-ada' });
    const todo = await db.column.create({
      data: { title: 'To do', order: 0, projectId: project.id },
    });
    await db.column.create({
      data: { title: 'Done', order: 1, projectId: project.id },
    });
    const card = await db.card.create({
      data: { title: 'Open card', columnId: todo.id },
    });
    await db.cardAssignee.create({ data: { cardId: card.id, userId: 'user-ada' } });
    db.membership.findMany.mockClear();

    render(await AppLayout({ children: await MyTasksPage() }));

    expect(getSessionFromAuth).toHaveBeenCalledTimes(1);
    expect(db.membership.findMany).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'My tasks' })).toBeInTheDocument();
    expect(screen.getByText('Open card')).toBeInTheDocument();
  });
});
