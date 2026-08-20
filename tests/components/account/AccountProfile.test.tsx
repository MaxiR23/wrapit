// tests/components/account/AccountProfile.test.tsx
//
// Tests for the Profile tab fields, visibility, and read-only local time.
//
// Tested:
// - Renders about-you and contact fields from the profile
// - Autosaves a text field on blur
// - Autosaves per-field visibility
// - Email value is read-only; local time is not an editable input
// - Only one visibility dropdown is open at a time
// - A successful public-name save updates the display name
// - A slower older save does not restore a stale display name
// - Surrounding whitespace is trimmed in the input after save
//
// What is covered:
// - Persistence, visibility, read-only fields, single-open menu, display name
//
// Run with: pnpm test:run tests/components/account/AccountProfile.test.tsx
//
// SEE: src/components/account/AccountProfile.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserProfileView } from '@/lib/userProfile';

const updateProfileField = vi.fn();
const updateProfileVisibility = vi.fn();

vi.mock('@/actions/updateProfileField', () => ({
  updateProfileField: (...args: unknown[]) => updateProfileField(...args),
}));
vi.mock('@/actions/updateProfileVisibility', () => ({
  updateProfileVisibility: (...args: unknown[]) => updateProfileVisibility(...args),
}));

const { default: AccountProfile } = await import('@/components/account/AccountProfile');
const { DisplayNameProvider, useDisplayName } =
  await import('@/components/account/DisplayNameProvider');

const profile: UserProfileView = {
  name: 'Ada Lovelace',
  username: 'ada',
  email: 'ada@example.com',
  fullName: 'Augusta Ada King',
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

function NameProbe() {
  const { name } = useDisplayName('fallback');
  return <p>shell-name:{name}</p>;
}

function renderProfile() {
  return render(
    <DisplayNameProvider initialName={profile.name} username={profile.username}>
      <NameProbe />
      <AccountProfile profile={profile} />
    </DisplayNameProvider>,
  );
}

describe('AccountProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProfileField.mockResolvedValue({ data: { field: 'pronouns', value: 'she/her' } });
    updateProfileVisibility.mockResolvedValue({ data: { field: 'photo', visibility: 'team' } });
  });

  it('renders stored fields and a read-only email', () => {
    renderProfile();

    expect(screen.getByLabelText('Full name')).toHaveValue('Augusta Ada King');
    expect(screen.getByLabelText('Public name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Email address')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Email address')).toHaveAttribute('readOnly');
  });

  it('autosaves a text field on blur', async () => {
    const events = userEvent.setup();
    renderProfile();

    const pronouns = screen.getByLabelText('Pronouns');
    await events.type(pronouns, 'she/her');
    await events.tab();

    await waitFor(() =>
      expect(updateProfileField).toHaveBeenCalledWith({ field: 'pronouns', value: 'she/her' }),
    );
  });

  it('autosaves visibility when an option is picked', async () => {
    const events = userEvent.setup();
    renderProfile();

    await events.click(screen.getByRole('button', { name: 'Profile photo visibility: Anyone' }));
    await events.click(screen.getByRole('menuitem', { name: 'Team only' }));

    await waitFor(() =>
      expect(updateProfileVisibility).toHaveBeenCalledWith({ field: 'photo', visibility: 'team' }),
    );
  });

  it('keeps local time read-only and computed', () => {
    renderProfile();

    expect(screen.getByText('Local time')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Local time' })).not.toBeInTheDocument();
    expect(screen.getByText(/GMT/)).toBeInTheDocument();
  });

  it('opens only one visibility dropdown at a time', async () => {
    const events = userEvent.setup();
    renderProfile();

    const triggers = screen.getAllByRole('button', { name: /visibility:/i });
    await events.click(triggers[0]!);
    expect(screen.getAllByRole('menu')).toHaveLength(1);

    await events.click(triggers[1]!);
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });

  it('updates the shell display name when public name is edited', async () => {
    const events = userEvent.setup();
    updateProfileField.mockResolvedValue({ data: { field: 'publicName', value: 'Ada King' } });
    renderProfile();

    const publicName = screen.getByLabelText('Public name');
    await events.clear(publicName);
    await events.type(publicName, 'Ada King');

    expect(screen.getByText('shell-name:Ada King')).toBeInTheDocument();
  });

  it('does not restore an older name when a slower save resolves after a newer edit', async () => {
    let releaseFirst: (value: { data: { field: string; value: string } }) => void = () => {};
    updateProfileField.mockImplementation((input: { field: string; value: string }) => {
      if (input.field === 'publicName' && input.value === 'Ada King') {
        return new Promise((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve({ data: input });
    });
    renderProfile();

    const publicName = screen.getByLabelText('Public name');
    fireEvent.change(publicName, { target: { value: 'Ada King' } });
    fireEvent.blur(publicName);
    await waitFor(() =>
      expect(updateProfileField).toHaveBeenCalledWith({ field: 'publicName', value: 'Ada King' }),
    );

    fireEvent.change(publicName, { target: { value: 'Grace Hopper' } });
    expect(screen.getByText('shell-name:Grace Hopper')).toBeInTheDocument();

    releaseFirst({ data: { field: 'publicName', value: 'Ada King' } });
    await Promise.resolve();
    expect(screen.getByText('shell-name:Grace Hopper')).toBeInTheDocument();
    expect(screen.queryByText('shell-name:Ada King')).not.toBeInTheDocument();
  });

  it('trims surrounding whitespace in the public name after save', async () => {
    updateProfileField.mockImplementation(async (input: { field: string; value: string }) => ({
      data: { field: input.field, value: input.value.trim() },
    }));
    renderProfile();

    const publicName = screen.getByLabelText('Public name');
    fireEvent.change(publicName, { target: { value: '  Grace Hopper  ' } });
    fireEvent.blur(publicName);

    await waitFor(() => expect(publicName).toHaveValue('Grace Hopper'));
    expect(updateProfileField).toHaveBeenCalledWith({
      field: 'publicName',
      value: '  Grace Hopper  ',
    });
    expect(screen.getByText('shell-name:Grace Hopper')).toBeInTheDocument();
  });
});
