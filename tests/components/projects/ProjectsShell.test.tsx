// tests/components/projects/ProjectsShell.test.tsx
//
// Tests for the projects shell content offset, tab bar, and phone height chain.
//
// Tested:
// - Default content reserves the tab bar plus the existing mobile gap
// - A board or account path uses the fill pane and tab-bar offset only
// - The tab bar still renders
// - The phone column can shrink so a descendant overflow-auto can scroll
// - Default list content is overflow-auto and flex-1 only from tablet
// - /account hides the projects search input
// - A query typed on /projects does not filter /tasks after navigating
// - Opening a board and coming back keeps the projects query
// - /account never has an active query
// - An open panel closes when the route changes
//
// What is covered:
// - Default and pathname-driven padding classes, bar presence, min-h-0 /
//   flex-1 class contract. jsdom cannot prove a node actually scrolls, iOS
//   bounce, last-item clearance above the bar, or that Next keeps this
//   chrome mounted across a real navigation.
//
// Run with: pnpm test:run tests/components/projects/ProjectsShell.test.tsx
//
// SEE: src/components/projects/ProjectsShell.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

const usePathname = vi.hoisted(() => vi.fn(() => '/projects'));

vi.mock('@/lib/authClient', () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname,
}));

vi.mock('@/actions/listNotifications', () => ({
  listNotifications: vi.fn(async () => ({ data: { items: [], unreadCount: 0 } })),
}));
vi.mock('@/actions/markNotificationRead', () => ({ markNotificationRead: vi.fn() }));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead: vi.fn() }));
vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation: vi.fn() }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation: vi.fn() }));

const { default: ProjectsShell } = await import('@/components/projects/ProjectsShell');
const { useProjectsSearch } = await import('@/components/projects/ProjectsSearch');
const { useOpenPanel } = await import('@/components/projects/OpenPanel');

const user = { name: 'Ada Lovelace', username: 'ada' };

function tabBar() {
  return screen.getByRole('link', { name: 'Account' }).closest('nav');
}

function PanelProbe() {
  const { openPanel, setOpenPanel } = useOpenPanel();
  return (
    <div>
      <p>panel:{openPanel ?? 'none'}</p>
      <button type="button" onClick={() => setOpenPanel('notifications')}>
        Open notifications
      </button>
      <button type="button" onClick={() => setOpenPanel('filters')}>
        Open filters
      </button>
    </div>
  );
}

function QueryProbe() {
  const { query, setQuery } = useProjectsSearch();
  return (
    <div>
      <output aria-label="Search query">{query}</output>
      <button type="button" onClick={() => setQuery('armed')}>
        Arm query
      </button>
    </div>
  );
}

function shellTree(child: ReactNode) {
  return <ProjectsShell user={user}>{child}</ProjectsShell>;
}

describe('ProjectsShell', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/projects');
  });

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

  it('still reserves the tab bar offset on a board path', () => {
    usePathname.mockReturnValue('/projects/project-1');

    render(
      <ProjectsShell user={user}>
        <p>Board</p>
      </ProjectsShell>,
    );

    const content = tabBar()?.previousElementSibling;

    expect(content).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden');
    expect(content).toHaveClass('max-tablet:pb-[var(--spacing-mobile-tab-bar)]');
    expect(content).not.toHaveClass('max-tablet:pb-[calc(var(--spacing-mobile-tab-bar)+1.5rem)]');
    expect(tabBar()).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search the board' })).toBeInTheDocument();
  });

  it('hides the projects search input on /account', () => {
    usePathname.mockReturnValue('/account');

    render(
      <ProjectsShell user={user}>
        <p>Account</p>
      </ProjectsShell>,
    );

    expect(screen.queryByRole('searchbox', { name: 'Search projects' })).not.toBeInTheDocument();
    const content = tabBar()?.previousElementSibling;
    expect(content).toHaveClass('max-tablet:pb-[var(--spacing-mobile-tab-bar)]');
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

  it('does not apply a projects query to /tasks after navigating', async () => {
    const actor = userEvent.setup();
    const view = render(shellTree(<p>Grid</p>));

    await actor.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'sprint');

    usePathname.mockReturnValue('/tasks');
    view.rerender(shellTree(<p>Tasks</p>));

    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toHaveValue('');
  });

  it('keeps a projects query after opening a board and coming back', async () => {
    const actor = userEvent.setup();
    const view = render(shellTree(<p>Grid</p>));

    await actor.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'sprint');

    usePathname.mockReturnValue('/projects/project-1');
    view.rerender(shellTree(<p>Board</p>));
    expect(screen.getByRole('searchbox', { name: 'Search the board' })).toHaveValue('');

    usePathname.mockReturnValue('/projects');
    view.rerender(shellTree(<p>Grid</p>));
    expect(screen.getByRole('searchbox', { name: 'Search projects' })).toHaveValue('sprint');
  });

  it('never has an active query on /account', async () => {
    const actor = userEvent.setup();
    const view = render(shellTree(<QueryProbe />));

    await actor.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'sprint');

    usePathname.mockReturnValue('/account');
    view.rerender(shellTree(<QueryProbe />));

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');

    await actor.click(screen.getByRole('button', { name: 'Arm query' }));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('');

    usePathname.mockReturnValue('/projects');
    view.rerender(shellTree(<QueryProbe />));
    expect(screen.getByRole('status', { name: 'Search query' })).toHaveTextContent('sprint');
  });

  it('closes an open panel when the route changes', async () => {
    const actor = userEvent.setup();
    const view = render(shellTree(<PanelProbe />));

    await actor.click(screen.getByRole('button', { name: 'Open notifications' }));
    expect(screen.getByText('panel:notifications')).toBeInTheDocument();

    view.rerender(shellTree(<PanelProbe />));
    expect(screen.getByText('panel:notifications')).toBeInTheDocument();

    usePathname.mockReturnValue('/tasks');
    view.rerender(shellTree(<PanelProbe />));
    expect(screen.getByText('panel:none')).toBeInTheDocument();
  });

  it('closes board filters when navigating to another board', async () => {
    const actor = userEvent.setup();
    usePathname.mockReturnValue('/projects/project-1');
    const view = render(shellTree(<PanelProbe />));

    await actor.click(screen.getByRole('button', { name: 'Open filters' }));
    expect(screen.getByText('panel:filters')).toBeInTheDocument();

    usePathname.mockReturnValue('/projects/project-2');
    view.rerender(shellTree(<PanelProbe />));
    expect(screen.getByText('panel:none')).toBeInTheDocument();
  });
});
