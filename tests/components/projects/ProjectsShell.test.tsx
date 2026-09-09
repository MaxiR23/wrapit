// tests/components/projects/ProjectsShell.test.tsx
//
// Tests for the projects shell content offset, tab bar, and phone height chain.
//
// Tested:
// - Default content reserves the tab bar plus the existing mobile gap
// - A contentClassName override still reserves the tab bar offset
// - The tab bar still renders
// - The phone column can shrink so a descendant overflow-auto can scroll
// - Default list content is overflow-auto and flex-1 only from tablet
//
// What is covered:
// - Default and override padding classes, bar presence, min-h-0 / flex-1
//   class contract. jsdom cannot prove a node actually scrolls, iOS bounce,
//   or last-item clearance above the bar.
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

    expect(content).toHaveClass('overflow-auto', 'min-h-0', 'tablet:flex-1');
    expect(content).not.toHaveClass('flex-1');
    expect(content).toHaveClass('max-tablet:pb-[calc(var(--spacing-mobile-tab-bar)+1.5rem)]');
    expect(screen.getByText('Grid')).toBeInTheDocument();
    expect(tabBar()).toBeInTheDocument();
  });

  it('lets the phone column shrink so descendant overflow can become a scrollport', () => {
    const { container } = render(
      <ProjectsShell user={user}>
        <p>Grid</p>
      </ProjectsShell>,
    );

    const column = container.querySelector('aside')?.nextElementSibling;

    expect(column).toHaveClass('min-h-0', 'min-w-0', 'flex-1', 'flex-col', 'overflow-hidden');
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
