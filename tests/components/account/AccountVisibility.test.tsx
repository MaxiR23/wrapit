// tests/components/account/AccountVisibility.test.tsx
//
// Tests for the Visibility tab: radio list, edit mode, add, preview, and pill.
//
// Tested:
// - Renders a radiogroup with the four default statuses and marks the active row
// - Selecting a radio updates the header pill and the static preview
// - Edit mode exposes name, description, color cycle, and remove
// - The last remaining status cannot be deleted
// - Add is disabled while the input is empty and appends a row when submitted
// - Typing in an edit-mode name does not remount the input
// - The preview is not interactive
// - An in-flight name or color save does not restore a stale active status
// - A failed name or color save reverts the row, the list, and the header pill
// - A late failure from an older selection does not override a newer one
// - A save that resolves after its status was deleted does not restore it
// - Rapid selections persist only the last choice, even when an earlier response
//   returns first
// - A to B to C to B ends on B and does not roll back from a stale first B
// - A to B to A writes A after a late B success so the database matches the UI
//
// What is covered:
// - Radio semantics, select, edit, last-status, add, focus, preview, stale autosave,
//   failed-save revert, overlapping selection, post-delete autosave, coalesced
//   selection writes
//
// Run with: pnpm test:run tests/components/account/AccountVisibility.test.tsx
//
// SEE: src/components/account/AccountVisibility.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserProfileView } from '@/lib/userProfile';
import { accountStatusesFixture } from '../../helpers/accountStatuses';

const setActiveStatus = vi.fn();
const updateUserStatusField = vi.fn();
const createUserStatus = vi.fn();
const deleteUserStatus = vi.fn();

vi.mock('@/actions/setActiveStatus', () => ({
  setActiveStatus: (...args: unknown[]) => setActiveStatus(...args),
}));
vi.mock('@/actions/updateUserStatusField', () => ({
  updateUserStatusField: (...args: unknown[]) => updateUserStatusField(...args),
}));
vi.mock('@/actions/createUserStatus', () => ({
  createUserStatus: (...args: unknown[]) => createUserStatus(...args),
}));
vi.mock('@/actions/deleteUserStatus', () => ({
  deleteUserStatus: (...args: unknown[]) => deleteUserStatus(...args),
}));
vi.mock('@/actions/updateProfileField', () => ({ updateProfileField: vi.fn() }));
vi.mock('@/actions/updateProfileVisibility', () => ({ updateProfileVisibility: vi.fn() }));
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

function renderVisibility(statuses = accountStatusesFixture) {
  return render(
    <DisplayNameProvider initialName={profile.name} username={profile.username}>
      <AccountScreen tab="visibility" profile={profile} statuses={statuses} />
    </DisplayNameProvider>,
  );
}

describe('AccountVisibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveStatus.mockResolvedValue({ data: { activeStatusId: 'status-inactive' } });
    updateUserStatusField.mockImplementation(async (input: { value: string }) => ({
      data: { value: input.value },
    }));
    createUserStatus.mockResolvedValue({
      data: {
        id: 'status-focus',
        name: 'Focus',
        description: 'Custom status',
        color: 'blue',
        order: 4,
      },
    });
    deleteUserStatus.mockResolvedValue({
      data: { id: 'status-inactive', activeStatusId: 'status-active' },
    });
  });

  it('renders a radiogroup with the active status marked', () => {
    renderVisibility();

    expect(screen.getByRole('radiogroup', { name: 'How you appear' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header'),
    ).toHaveTextContent('Active');
  });

  it('updates the header pill and the preview when a status is selected', async () => {
    const events = userEvent.setup();
    renderVisibility();

    await events.click(screen.getByRole('radio', { name: 'Inactive' }));

    expect(setActiveStatus).toHaveBeenCalledWith({ statusId: 'status-inactive' });
    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(header).toHaveTextContent('Inactive');
    expect(
      within(screen.getByRole('region', { name: 'How the team sees it' })).getByText('Inactive'),
    ).toBeInTheDocument();
  });

  it('exposes name, description, color, and remove in edit mode', async () => {
    const events = userEvent.setup();
    renderVisibility();

    await events.click(screen.getByRole('button', { name: 'Edit statuses' }));

    expect(screen.getByRole('textbox', { name: 'Active name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Active description' })).toHaveValue(
      'Available for the team',
    );
    expect(screen.getAllByRole('button', { name: 'Change color' })).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Remove Active' })).toBeEnabled();
  });

  it('disables remove when only one status remains', async () => {
    const events = userEvent.setup();
    renderVisibility({
      activeStatusId: 'status-active',
      statuses: [accountStatusesFixture.statuses[0]!],
    });

    await events.click(screen.getByRole('button', { name: 'Edit statuses' }));

    expect(screen.getByRole('button', { name: 'Remove Active' })).toBeDisabled();
    await events.click(screen.getByRole('button', { name: 'Remove Active' }));
    expect(deleteUserStatus).not.toHaveBeenCalled();
  });

  it('keeps Add disabled while the input is empty and appends a row when submitted', async () => {
    const events = userEvent.setup();
    renderVisibility();

    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();

    await events.type(screen.getByLabelText('Add a status'), 'Focus');
    expect(add).toBeEnabled();
    await events.click(add);

    expect(createUserStatus).toHaveBeenCalledWith({ name: 'Focus' });
    expect(screen.getByRole('radio', { name: 'Focus' })).toBeInTheDocument();
    expect(screen.getByLabelText('Add a status')).toHaveValue('');
  });

  it('does not lose focus while typing a status name in edit mode', async () => {
    const events = userEvent.setup();
    renderVisibility();

    await events.click(screen.getByRole('button', { name: 'Edit statuses' }));
    const input = screen.getByRole('textbox', { name: 'Active name' });
    await events.click(input);
    await events.type(input, ' now');

    expect(input).toHaveFocus();
    expect(input).toHaveValue('Active now');
  });

  it('cycles color through the palette', async () => {
    const events = userEvent.setup();
    renderVisibility();

    await events.click(screen.getByRole('button', { name: 'Edit statuses' }));
    await events.click(screen.getAllByRole('button', { name: 'Change color' })[0]!);

    expect(updateUserStatusField).toHaveBeenCalledWith({
      statusId: 'status-active',
      field: 'color',
      value: 'gray',
    });
  });

  it('renders a static preview without links or buttons', () => {
    renderVisibility();

    const preview = screen.getByRole('region', { name: 'How the team sees it' });
    expect(within(preview).queryByRole('link')).not.toBeInTheDocument();
    expect(within(preview).queryByRole('button')).not.toBeInTheDocument();
    expect(within(preview).getByText('AL')).toBeInTheDocument();
    expect(within(preview).getByText('@ada')).toBeInTheDocument();
    expect(within(preview).getByText('Active')).toBeInTheDocument();
  });

  it('does not restore a stale active status when a name save resolves after a new selection', async () => {
    const events = userEvent.setup();
    let release: (value: { data: { value: string } }) => void = () => {};
    updateUserStatusField.mockImplementation((input: { field: string; value: string }) => {
      if (input.field === 'name') {
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve({ data: { value: input.value } });
    });

    renderVisibility();
    await events.click(screen.getByRole('button', { name: 'Edit statuses' }));
    const input = screen.getByRole('textbox', { name: 'Active name' });
    await events.type(input, ' now');
    fireEvent.blur(input);
    await waitFor(() => expect(updateUserStatusField).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getAllByRole('radio')[1]!);
      release({ data: { value: 'Active now' } });
    });

    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(header).toHaveTextContent('Inactive');
    expect(
      within(screen.getByRole('region', { name: 'How the team sees it' })).getByText('Inactive'),
    ).toBeInTheDocument();
  });

  it('does not restore a stale active status when a color save resolves after a new selection', async () => {
    const events = userEvent.setup();
    let release: (value: { data: { value: string } }) => void = () => {};
    updateUserStatusField.mockImplementation((input: { field: string; value: string }) => {
      if (input.field === 'color') {
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve({ data: { value: input.value } });
    });

    renderVisibility();
    await events.click(screen.getByRole('button', { name: 'Edit statuses' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Change color' })[0]!);
    await waitFor(() => expect(updateUserStatusField).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getAllByRole('radio')[1]!);
      release({ data: { value: 'gray' } });
    });

    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(header).toHaveTextContent('Inactive');
    expect(
      within(screen.getByRole('region', { name: 'How the team sees it' })).getByText('Inactive'),
    ).toBeInTheDocument();
  });

  it('reverts the row, list, and header pill when a name save fails', async () => {
    const events = userEvent.setup();
    updateUserStatusField.mockImplementation(async (input: { field: string; value: string }) => {
      if (input.field === 'name') {
        return { error: 'Something went wrong. Please try again.' };
      }
      return { data: { value: input.value } };
    });

    renderVisibility();
    await events.click(screen.getByRole('button', { name: 'Edit statuses' }));
    const input = screen.getByRole('textbox', { name: 'Active name' });
    await events.type(input, ' now');
    fireEvent.blur(input);

    await waitFor(() => expect(input).toHaveValue('Active'));

    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(within(header!).queryByText('Active now')).not.toBeInTheDocument();
    expect(within(header!).getByText('Active')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Inactive' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Active' }));

    expect(within(header!).queryByText('Active now')).not.toBeInTheDocument();
    expect(within(header!).getByText('Active')).toBeInTheDocument();
  });

  it('reverts the row, list, and header pill when a color save fails', async () => {
    const events = userEvent.setup();
    updateUserStatusField.mockImplementation(async (input: { field: string; value: string }) => {
      if (input.field === 'color') {
        return { error: 'Something went wrong. Please try again.' };
      }
      return { data: { value: input.value } };
    });

    renderVisibility();
    await events.click(screen.getByRole('button', { name: 'Edit statuses' }));
    const swatch = screen.getAllByRole('button', { name: 'Change color' })[0]!;
    fireEvent.click(swatch);

    await waitFor(() => {
      expect(swatch).toHaveClass('bg-user-status-green/30');
      expect(swatch).not.toHaveClass('bg-user-status-gray/30');
    });

    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    const pill = within(header!).getByText('Active');
    expect(pill).toHaveClass('text-user-status-green');
    expect(pill).not.toHaveClass('text-user-status-gray');

    fireEvent.click(screen.getByRole('radio', { name: 'Inactive' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Active' }));

    expect(within(header!).getByText('Active')).toHaveClass('text-user-status-green');
    expect(within(header!).getByText('Active')).not.toHaveClass('text-user-status-gray');
  });

  it('does not restore an older selection when a later one is current and the older request fails', async () => {
    let failInactive: (value: { error: string }) => void = () => {};
    setActiveStatus.mockImplementation((input: { statusId: string }) => {
      if (input.statusId === 'status-inactive') {
        return new Promise((resolve) => {
          failInactive = resolve;
        });
      }
      return Promise.resolve({ data: { activeStatusId: input.statusId } });
    });

    renderVisibility();
    fireEvent.click(screen.getByRole('radio', { name: 'Inactive' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Do not disturb' }));

    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(header).toHaveTextContent('Do not disturb');

    await act(async () => {
      failInactive({ error: 'Something went wrong. Please try again.' });
    });

    expect(header).toHaveTextContent('Do not disturb');
    expect(header).not.toHaveTextContent('Active');
    expect(header).not.toHaveTextContent('Inactive');
    expect(screen.getByRole('radio', { name: 'Do not disturb' })).toBeChecked();
  });

  it('does not restore a deleted status when its pending save resolves', async () => {
    const events = userEvent.setup();
    let releaseName: (value: { data: { value: string } }) => void = () => {};
    updateUserStatusField.mockImplementation((input: { field: string; value: string }) => {
      if (input.field === 'name') {
        return new Promise((resolve) => {
          releaseName = resolve;
        });
      }
      return Promise.resolve({ data: { value: input.value } });
    });
    deleteUserStatus.mockResolvedValue({
      data: { id: 'status-active', activeStatusId: 'status-inactive' },
    });

    renderVisibility();
    await events.click(screen.getByRole('button', { name: 'Edit statuses' }));
    const input = screen.getByRole('textbox', { name: 'Active name' });
    await events.type(input, ' now');
    fireEvent.blur(input);
    await waitFor(() => expect(updateUserStatusField).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Remove Active now' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Remove Active now' })).not.toBeInTheDocument();
    });

    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(within(header!).getByText('Inactive')).toBeInTheDocument();

    await act(async () => {
      releaseName({ data: { value: 'Active now' } });
    });

    expect(within(header!).queryByText('Active now')).not.toBeInTheDocument();
    expect(within(header!).getByText('Inactive')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'How the team sees it' })).getByText('Inactive'),
    ).toBeInTheDocument();
  });

  it('persists the last of several rapid selections after the in-flight write returns', async () => {
    let releaseFirst: (value: { data: { activeStatusId: string } }) => void = () => {};
    let first = true;
    setActiveStatus.mockImplementation((input: { statusId: string }) => {
      if (first) {
        first = false;
        return new Promise((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve({ data: { activeStatusId: input.statusId } });
    });

    renderVisibility();
    fireEvent.click(screen.getByRole('radio', { name: 'Inactive' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Do not disturb' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Out of office' }));

    expect(setActiveStatus).toHaveBeenCalledTimes(1);
    expect(setActiveStatus).toHaveBeenCalledWith({ statusId: 'status-inactive' });
    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(header).toHaveTextContent('Out of office');

    await act(async () => {
      releaseFirst({ data: { activeStatusId: 'status-inactive' } });
    });

    await waitFor(() => {
      expect(setActiveStatus).toHaveBeenLastCalledWith({ statusId: 'status-ooo' });
    });
    expect(setActiveStatus).toHaveBeenCalledTimes(2);
    expect(header).toHaveTextContent('Out of office');
    expect(screen.getByRole('radio', { name: 'Out of office' })).toBeChecked();
  });

  it('ends on B after A to B to C to B and ignores a stale failure from the first B', async () => {
    let failFirstB: (value: { error: string }) => void = () => {};
    let first = true;
    setActiveStatus.mockImplementation((input: { statusId: string }) => {
      if (first) {
        first = false;
        return new Promise((resolve) => {
          failFirstB = resolve;
        });
      }
      return Promise.resolve({ data: { activeStatusId: input.statusId } });
    });

    renderVisibility();
    fireEvent.click(screen.getByRole('radio', { name: 'Inactive' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Do not disturb' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Inactive' }));

    expect(setActiveStatus).toHaveBeenCalledTimes(1);
    expect(setActiveStatus).toHaveBeenCalledWith({ statusId: 'status-inactive' });
    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(header).toHaveTextContent('Inactive');

    await act(async () => {
      failFirstB({ error: 'Something went wrong. Please try again.' });
    });

    await waitFor(() => expect(setActiveStatus).toHaveBeenCalledTimes(2));
    expect(setActiveStatus).toHaveBeenLastCalledWith({ statusId: 'status-inactive' });
    expect(header).toHaveTextContent('Inactive');
    expect(header).not.toHaveTextContent('Do not disturb');
    expect(screen.getByRole('radio', { name: 'Inactive' })).toBeChecked();
  });

  it('writes A after a late B success when the user selects A then B then A', async () => {
    let releaseB: (value: { data: { activeStatusId: string } }) => void = () => {};
    let first = true;
    setActiveStatus.mockImplementation((input: { statusId: string }) => {
      if (first) {
        first = false;
        return new Promise((resolve) => {
          releaseB = resolve;
        });
      }
      return Promise.resolve({ data: { activeStatusId: input.statusId } });
    });

    renderVisibility();
    fireEvent.click(screen.getByRole('radio', { name: 'Inactive' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Active' }));

    expect(setActiveStatus).toHaveBeenCalledTimes(1);
    expect(setActiveStatus).toHaveBeenCalledWith({ statusId: 'status-inactive' });
    const header = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('header');
    expect(header).toHaveTextContent('Active');
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();

    await act(async () => {
      releaseB({ data: { activeStatusId: 'status-inactive' } });
    });

    await waitFor(() => {
      expect(setActiveStatus).toHaveBeenLastCalledWith({ statusId: 'status-active' });
    });
    expect(setActiveStatus).toHaveBeenCalledTimes(2);
    expect(header).toHaveTextContent('Active');
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
  });
});
