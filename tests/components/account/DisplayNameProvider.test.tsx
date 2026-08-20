// tests/components/account/DisplayNameProvider.test.tsx
//
// Tests that a public-name save updates shell identity without a navigation.
//
// Tested:
// - Desktop topbar, mobile header, account header, and profile card initials update together
// - Desktop and mobile account menus show the new name and recomputed initials
//
// What is covered:
// - Live display name and initials on every current-user avatar
//
// Run with: pnpm test:run tests/components/account/DisplayNameProvider.test.tsx
//
// SEE: src/components/account/DisplayNameProvider.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserProfileView } from '@/lib/userProfile';
import { accountStatusesFixture } from '../../helpers/accountStatuses';

const updateProfileField = vi.fn();
const updateProfileVisibility = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/actions/updateProfileField', () => ({
  updateProfileField: (...args: unknown[]) => updateProfileField(...args),
}));
vi.mock('@/actions/updateProfileVisibility', () => ({
  updateProfileVisibility: (...args: unknown[]) => updateProfileVisibility(...args),
}));
vi.mock('@/actions/listNotifications', () => ({
  listNotifications: vi.fn(async () => ({ data: { items: [], unreadCount: 0 } })),
}));
vi.mock('@/actions/markNotificationRead', () => ({ markNotificationRead: vi.fn() }));
vi.mock('@/actions/markAllNotificationsRead', () => ({ markAllNotificationsRead: vi.fn() }));
vi.mock('@/actions/acceptInvitation', () => ({ acceptInvitation: vi.fn() }));
vi.mock('@/actions/rejectInvitation', () => ({ rejectInvitation: vi.fn() }));
vi.mock('@/actions/setActiveStatus', () => ({ setActiveStatus: vi.fn() }));
vi.mock('@/actions/updateUserStatusField', () => ({ updateUserStatusField: vi.fn() }));
vi.mock('@/actions/createUserStatus', () => ({ createUserStatus: vi.fn() }));
vi.mock('@/actions/deleteUserStatus', () => ({ deleteUserStatus: vi.fn() }));

const { default: ProjectsShell } = await import('@/components/projects/ProjectsShell');
const { default: AccountScreen } = await import('@/components/account/AccountScreen');

const profile: UserProfileView = {
  name: 'Ada Lovelace',
  username: 'ada',
  email: 'ada@example.com',
  fullName: '',
  pronouns: '',
  jobTitle: '',
  department: '',
  organization: '',
  location: '',
  workingWithYou: '',
  visibilities: {
    photo: 'anyone',
    fullName: 'anyone',
    publicName: 'anyone',
    pronouns: 'anyone',
    jobTitle: 'anyone',
    department: 'anyone',
    organization: 'anyone',
    location: 'anyone',
    localTime: 'anyone',
    workingWithYou: 'anyone',
    email: 'admins',
  },
};

const shellUser = { name: 'Ada Lovelace', username: 'ada' };

describe('live display name in the shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProfileField.mockResolvedValue({
      data: { field: 'publicName', value: 'Grace Hopper' },
    });
    updateProfileVisibility.mockResolvedValue({ data: { field: 'photo', visibility: 'anyone' } });
  });

  it('updates initials in the topbar, mobile header, account header, and profile card at once', async () => {
    const events = userEvent.setup();
    render(
      <ProjectsShell user={shellUser} showSearch={false}>
        <AccountScreen tab="profile" profile={profile} statuses={accountStatusesFixture} />
      </ProjectsShell>,
    );

    const publicName = screen.getByLabelText('Public name');
    await events.clear(publicName);
    await events.type(publicName, 'Grace Hopper');
    await events.tab();

    await waitFor(() =>
      expect(updateProfileField).toHaveBeenCalledWith({
        field: 'publicName',
        value: 'Grace Hopper',
      }),
    );

    const [mobileAccount, desktopAccount] = screen.getAllByRole('button', { name: 'Account' });
    expect(mobileAccount).toHaveTextContent('GH');
    expect(desktopAccount).toHaveTextContent('GH');

    const accountHeader = screen.getByRole('heading', { name: 'Grace Hopper' }).closest('header');
    expect(accountHeader).not.toBeNull();
    expect(within(accountHeader!).getByText('GH')).toBeInTheDocument();

    expect(within(screen.getByRole('tabpanel')).getByText('GH')).toBeInTheDocument();

    await events.click(desktopAccount!);

    const menus = screen.getAllByRole('dialog', { name: 'Account' });
    expect(menus).toHaveLength(2);
    for (const menu of menus) {
      expect(within(menu).getByText('Grace Hopper')).toBeInTheDocument();
      expect(within(menu).getByText('GH')).toBeInTheDocument();
    }
  });
});
