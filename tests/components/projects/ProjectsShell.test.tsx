// tests/components/projects/ProjectsShell.test.tsx
//
// Tests for the projects shell content offset and tab bar.
//
// Tested:
// - Default content reserves the tab bar plus the existing mobile gap
// - A contentClassName override still reserves the tab bar offset
// - The tab bar still renders
//
// What is covered:
// - Default and override padding classes, bar presence
//
// Run with: pnpm test:run tests/components/projects/ProjectsShell.test.tsx
//
// SEE: src/components/projects/ProjectsShell.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/authClient', () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/actions/listNotifications', () => ({
  listNotifications: vi.fn(async () => ({ data: { items: [], unreadCount: 0 } })),
}));
vi.mock('@/actions/markNotificationRead', () => ({ markNotificationRead: vi.fn() }));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead: vi.fn() }));
vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation: vi.fn() }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation: vi.fn() }));

const { default: ProjectsShell } = await import('@/components/projects/ProjectsShell');

const user = { name: 'Ada Lovelace', username: 'ada' };

function tabBar() {
  return screen.getByRole('link', { name: 'Account' }).closest('nav');
}

describe('ProjectsShell', () => {
  it('reserves the tab bar plus the existing mobile gap on default content', () => {
    render(
      <ProjectsShell user={user}>
        <p>Grid</p>
      </ProjectsShell>,
    );

    const content = tabBar()?.previousElementSibling;

    expect(content).toHaveClass('max-tablet:pb-[calc(var(--spacing-mobile-tab-bar)+1.5rem)]');
    expect(screen.getByText('Grid')).toBeInTheDocument();
    expect(tabBar()).toBeInTheDocument();
  });

  it('still reserves the tab bar offset when contentClassName is passed', () => {
    render(
      <ProjectsShell user={user} contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p>Board</p>
      </ProjectsShell>,
    );

    const content = tabBar()?.previousElementSibling;

    expect(content).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden');
    expect(content).toHaveClass('max-tablet:pb-[var(--spacing-mobile-tab-bar)]');
    expect(content).not.toHaveClass('max-tablet:pb-[calc(var(--spacing-mobile-tab-bar)+1.5rem)]');
    expect(tabBar()).toBeInTheDocument();
  });

  it('fills the padded canvas and keeps the phone header in flow', () => {
    const { container } = render(
      <ProjectsShell user={user}>
        <p>Grid</p>
      </ProjectsShell>,
    );

    expect(container.firstChild).toHaveClass('h-full');
    const header = container.querySelector('header');
    expect(header).toHaveClass('h-mobile-header', 'tablet:hidden');
    expect(header).not.toHaveClass('fixed');
    expect(header?.className).not.toMatch(/safe-area-inset/);
  });
});
