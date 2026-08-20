// tests/components/account/AccountScreen.test.tsx
//
// Tests for the account screen header, tablist, and placeholder tabs.
//
// Tested:
// - Renders name, @username, and a tablist of four tabs
// - Profile is selected by default and the other tabs show a placeholder
// - Tab hrefs are shareable /account?tab= URLs
// - A public-name change updates the header initials without a reload
//
// What is covered:
// - Header, tablist semantics, placeholders, hrefs
//
// Run with: pnpm test:run tests/components/account/AccountScreen.test.tsx
//
// SEE: src/components/account/AccountScreen.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserProfileView } from '@/lib/userProfile';

vi.mock('@/actions/updateProfileField', () => ({
  updateProfileField: vi.fn(async (input: unknown) => ({ data: input })),
}));
vi.mock('@/actions/updateProfileVisibility', () => ({ updateProfileVisibility: vi.fn() }));

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

function renderScreen(tab: 'profile' | 'visibility' | 'activity' | 'cards') {
  return render(
    <DisplayNameProvider initialName={profile.name} username={profile.username}>
      <AccountScreen tab={tab} profile={profile} />
    </DisplayNameProvider>,
  );
}

describe('AccountScreen', () => {
  it('renders the header and a tablist of four tabs', () => {
    renderScreen('profile');

    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('@ada')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Profile',
      'Visibility',
      'Activity',
      'Cards',
    ]);
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/account?tab=profile',
    );
  });

  it('shows a placeholder for tabs that are not Profile', () => {
    renderScreen('visibility');

    expect(screen.getByRole('tab', { name: 'Visibility' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Visibility is coming soon.')).toBeInTheDocument();
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
