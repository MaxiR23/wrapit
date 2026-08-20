// tests/app/account/accountPage.test.tsx
//
// Tests for the /account page tab routing and shell.
//
// Tested:
// - Renders Profile for a missing tab query
// - Redirects an unknown tab to ?tab=profile
// - Redirects when there is no session
// - Hides the projects search input
//
// What is covered:
// - Default tab, unknown-tab redirect, unauthenticated redirect, no search
//
// Run with: pnpm test:run tests/app/account/accountPage.test.tsx
//
// SEE: src/app/account/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { accountStatusesFixture } from '../../helpers/accountStatuses';

const getSession = vi.fn();
const getUserProfileForUser = vi.fn();
const getUserStatusesForUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/userProfile', () => ({
  getUserProfileForUser,
}));

vi.mock('@/lib/userStatuses', () => ({
  getUserStatusesForUser,
}));

vi.mock('@/lib/notifications', () => ({
  getNotificationsForUser: vi.fn(async () => ({ items: [], unreadCount: 0 })),
}));

vi.mock('@/actions/updateProfileField', () => ({ updateProfileField: vi.fn() }));
vi.mock('@/actions/updateProfileVisibility', () => ({ updateProfileVisibility: vi.fn() }));
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

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: AccountPage } = await import('@/app/account/page');

const profile = {
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

describe('Account page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
    });
    getUserProfileForUser.mockResolvedValue(profile);
    getUserStatusesForUser.mockResolvedValue(accountStatusesFixture);
  });

  it('renders Profile when the tab query is missing', async () => {
    render(await AccountPage({ searchParams: Promise.resolve({}) } as never));

    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Search projects' })).not.toBeInTheDocument();
  });

  it('redirects an unknown tab to ?tab=profile', async () => {
    await expect(
      AccountPage({ searchParams: Promise.resolve({ tab: 'perfil' }) } as never),
    ).rejects.toThrow('NEXT_REDIRECT:/account?tab=profile');
    expect(redirect).toHaveBeenCalledWith('/account?tab=profile');
  });

  it('redirects when there is no session', async () => {
    getSession.mockResolvedValue(null);

    await expect(AccountPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in',
    );
  });
});
