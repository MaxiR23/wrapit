// tests/app/projects/projectDetail.test.tsx
//
// Tests for the project detail page access gates.
//
// Tested:
// - Renders the project title for a member
// - A project with no columns still renders the board header and can open Share
// - Does not wrap the page in the projects shell
// - Shows the board search input on the board header
// - Does not render the Members heading
// - Mounts the recents recorder after access is confirmed
// - Calls notFound when getBoardPageForUser returns null
//
// What is covered:
// - Member happy path, empty-column Share, missing project as 404. Shell
//   chrome (sidebar, topbar, tab bar) lives in the authenticated layout.
//
// Run with: pnpm test:run tests/app/projects/projectDetail.test.tsx
//
// SEE: src/app/(app)/projects/[projectId]/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import { ProjectsSearchProvider } from '@/components/projects/ProjectsSearch';

const getSession = vi.fn();
const getBoardPageForUser = vi.fn();
const getArchivedProjectForUser = vi.fn();
const listProjectMembers = vi.fn();
const recordRecentProject = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/projects', () => ({
  getBoardPageForUser,
  getArchivedProjectForUser,
}));

vi.mock('@/actions/recordRecentProject', () => ({
  recordRecentProject,
}));

vi.mock('@/actions/listNotifications', () => ({
  listNotifications: vi.fn(async () => ({ data: { items: [], unreadCount: 0 } })),
}));
vi.mock('@/actions/markNotificationRead', () => ({ markNotificationRead: vi.fn() }));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead: vi.fn() }));
vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation: vi.fn() }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation: vi.fn() }));
vi.mock('@/actions/moveCard', () => ({ moveCard: vi.fn() }));
vi.mock('@/actions/createCard', () => ({ createCard: vi.fn() }));
vi.mock('@/actions/archiveCard', () => ({ archiveCard: vi.fn() }));
vi.mock('@/actions/deleteCard', () => ({ deleteCard: vi.fn() }));
vi.mock('@/actions/updateCardField', () => ({
  updateCardField: vi.fn(async (input: { value: string }) => ({ data: { value: input.value } })),
}));
vi.mock('@/actions/updateCardAssignees', () => ({
  updateCardAssignees: vi.fn(async () => ({ data: { assignees: [] } })),
}));
vi.mock('@/actions/updateCardLabel', () => ({
  updateCardLabel: vi.fn(async () => ({ data: { labelId: null } })),
}));
vi.mock('@/actions/createSubtask', () => ({ createSubtask: vi.fn() }));
vi.mock('@/actions/updateSubtaskField', () => ({
  updateSubtaskField: vi.fn(async (input: { value: string | boolean }) => ({
    data: { value: input.value },
  })),
}));
vi.mock('@/actions/deleteSubtask', () => ({ deleteSubtask: vi.fn() }));
vi.mock('@/actions/createComment', () => ({ createComment: vi.fn() }));
vi.mock('@/actions/updateComment', () => ({ updateComment: vi.fn() }));
vi.mock('@/actions/updateLabelField', () => ({
  updateLabelField: vi.fn(async (input: { value: string }) => ({ data: { value: input.value } })),
}));
vi.mock('@/actions/createLabel', () => ({ createLabel: vi.fn() }));
vi.mock('@/actions/deleteLabel', () => ({ deleteLabel: vi.fn() }));
vi.mock('@/actions/updateBoardVisibility', () => ({
  updateBoardVisibility: vi.fn(async (visibility: unknown) => ({ data: visibility })),
}));
vi.mock('@/actions/createInvitation', () => ({ createInvitation: vi.fn() }));
vi.mock('@/actions/updateMembershipAccess', () => ({ updateMembershipAccess: vi.fn() }));
vi.mock('@/actions/updateMembershipRole', () => ({ updateMembershipRole: vi.fn() }));
vi.mock('@/actions/removeMember', () => ({ removeMember: vi.fn() }));
vi.mock('@/actions/updatePublicLink', () => ({ updatePublicLink: vi.fn() }));
vi.mock('@/actions/transferOwnership', () => ({ transferOwnership: vi.fn() }));
vi.mock('@/actions/leaveProject', () => ({ leaveProject: vi.fn() }));
vi.mock('@/actions/archiveProject', () => ({ archiveProject: vi.fn() }));
vi.mock('@/actions/listProjectMembers', () => ({
  listProjectMembers: (...args: unknown[]) => listProjectMembers(...args),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect,
  notFound,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: ProjectDetailPage } = await import('@/app/(app)/projects/[projectId]/page');

function pageProps(projectId: string, search: Record<string, string | string[]> = {}) {
  return {
    params: Promise.resolve({ projectId }),
    searchParams: Promise.resolve(search),
  };
}

function renderPage(node: ReactNode) {
  return render(
    <OpenPanelProvider>
      <ProjectsSearchProvider>{node}</ProjectsSearchProvider>
    </OpenPanelProvider>,
  );
}

describe('Project detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLElement.prototype.scrollTo = vi.fn();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    recordRecentProject.mockResolvedValue(undefined);
    listProjectMembers.mockResolvedValue({
      data: {
        members: [
          {
            membershipId: 'mem-ada',
            userId: 'user-ada',
            name: 'Ada Lovelace',
            username: 'ada',
            role: 'OWNER',
            access: 'EDIT',
          },
        ],
      },
    });
    getBoardPageForUser.mockResolvedValue({
      id: 'project-1',
      title: 'Sprint board',
      ownerId: 'user-ada',
      publicLinkEnabled: false,
      columns: [],
      members: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
      viewer: { role: 'OWNER', access: 'EDIT' },
      labels: [{ id: 'l0', name: 'Design', tone: 'blue', order: 0 }],
      boardVisibility: {
        label: true,
        code: true,
        comments: true,
        subtasks: true,
        dueDate: true,
        assignees: true,
      },
    });
  });

  it('renders the board header and can open Share when the project has no columns', async () => {
    const events = userEvent.setup();

    const page = await ProjectDetailPage(pageProps('project-1'));
    renderPage(page);

    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(
      screen.getByText('This project has no columns yet. Create one to get started.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('searchbox', { name: 'Search the board' }).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(getBoardPageForUser).toHaveBeenCalledWith('project-1', 'user-ada');
    expect(listProjectMembers).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(recordRecentProject).toHaveBeenCalledWith('project-1');
    });

    await events.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('heading', { name: 'Share board' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listProjectMembers).toHaveBeenCalledWith({ projectId: 'project-1' });
    });
  });

  it('renders the board title when the project has columns', async () => {
    getBoardPageForUser.mockResolvedValue({
      id: 'project-1',
      title: 'Sprint board',
      ownerId: 'user-ada',
      publicLinkEnabled: false,
      columns: [{ id: 'column-todo', title: 'To do', order: 0, cards: [] }],
      members: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
      viewer: { role: 'OWNER', access: 'EDIT' },
      labels: [],
      boardVisibility: {
        label: true,
        code: true,
        comments: true,
        subtasks: true,
        dueDate: true,
        assignees: true,
      },
    });

    renderPage(await ProjectDetailPage(pageProps('project-1')));

    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
  });

  it('calls notFound when the project belongs to someone else', async () => {
    getBoardPageForUser.mockResolvedValue(null);
    getArchivedProjectForUser.mockResolvedValue(null);

    await expect(ProjectDetailPage(pageProps('project-1'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    expect(getArchivedProjectForUser).toHaveBeenCalledWith('project-1', 'user-ada');
  });

  it('redirects a member of an archived project to /archived', async () => {
    getBoardPageForUser.mockResolvedValue(null);
    getArchivedProjectForUser.mockResolvedValue({ id: 'project-1' });

    await expect(ProjectDetailPage(pageProps('project-1'))).rejects.toThrow(
      'NEXT_REDIRECT:/archived',
    );
    expect(redirect).toHaveBeenCalledWith('/archived');
    expect(notFound).not.toHaveBeenCalled();
  });

  it('calls notFound when the project id is unknown', async () => {
    getBoardPageForUser.mockResolvedValue(null);
    getArchivedProjectForUser.mockResolvedValue(null);

    await expect(ProjectDetailPage(pageProps('missing'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
