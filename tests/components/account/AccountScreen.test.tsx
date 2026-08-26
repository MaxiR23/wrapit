// tests/components/account/AccountScreen.test.tsx
//
// Tests for the account screen header, tablist, Visibility tab, and Activity.
//
// Tested:
// - Renders name, @username, status pill, and a tablist of three tabs
// - Profile is selected by default
// - Visibility renders the status list
// - Activity renders the projects and timeline regions
// - Tab hrefs are shareable /account?tab= URLs
// - A public-name change updates the header initials without a reload
//
// What is covered:
// - Header, tablist semantics, Activity tab, hrefs
//
// Run with: pnpm test:run tests/components/account/AccountScreen.test.tsx
//
// SEE: src/components/account/AccountScreen.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserProfileView } from '@/lib/userProfile';
import { accountStatusesFixture } from '../../helpers/accountStatuses';

vi.mock('@/actions/updateProfileField', () => ({
  updateProfileField: vi.fn(async (input: unknown) => ({ data: input })),
}));
vi.mock('@/actions/updateProfileVisibility', () => ({ updateProfileVisibility: vi.fn() }));
vi.mock('@/actions/setActiveStatus', () => ({ setActiveStatus: vi.fn() }));
vi.mock('@/actions/updateUserStatusField', () => ({ updateUserStatusField: vi.fn() }));
vi.mock('@/actions/createUserStatus', () => ({ createUserStatus: vi.fn() }));
vi.mock('@/actions/deleteUserStatus', () => ({ deleteUserStatus: vi.fn() }));
vi.mock('@/actions/listMyActivityEvents', () => ({
  listMyActivityEvents: vi.fn(async () => ({ data: { items: [], nextCursor: null } })),
}));

const { default: AccountScreen } = await import('@/components/account/AccountScreen');
const { DisplayNameProvider } = await import('@/components/account/DisplayNameProvider');

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

function renderScreen(tab: 'profile' | 'visibility' | 'activity') {
  return render(
    <DisplayNameProvider initialName={profile.name} username={profile.username}>
      <AccountScreen tab={tab} profile={profile} statuses={accountStatusesFixture} />
    </DisplayNameProvider>,
  );
}

describe('AccountScreen', () => {
  it('renders the header and a tablist of three tabs', () => {
    renderScreen('profile');

    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('@ada')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Profile', 'Visibility', 'Activity']);
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/account?tab=profile',
    );
    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(header).toHaveTextContent('Active');
  });

  it('shows the Visibility tab instead of a placeholder', () => {
    renderScreen('visibility');

    expect(screen.getByRole('tab', { name: 'Visibility' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('radiogroup', { name: 'How you appear' })).toBeInTheDocument();
    expect(screen.queryByText('Visibility is coming soon.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
  });

  it('shows the Activity tab instead of a placeholder', () => {
    renderScreen('activity');

    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Your projects' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your activity' })).toBeInTheDocument();
    expect(screen.queryByText('Activity is coming soon.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
  });

  it('updates the header initials when the public name changes', async () => {
    const events = userEvent.setup();
    renderScreen('profile');

    const publicName = screen.getByLabelText('Public name');
    await events.clear(publicName);
    await events.type(publicName, 'Grace Hopper');

    const header = screen.getByRole('heading', { name: 'Grace Hopper' }).closest('header');
    expect(header).not.toBeNull();
    expect(within(header!).getByText('GH')).toBeInTheDocument();
  });
});
