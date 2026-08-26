// tests/components/account/AccountMenu.test.tsx
//
// Tests for the topbar account menu: identity, tab links, sign out, chrome,
// Escape, outside click, and focus return.
//
// Tested:
// - Renders the session name and @username
// - Wires the three /account?tab= links
// - Desktop popover uses hidden md:block and w-[236px]; sheet uses md:hidden
// - Sign out ends the session and goes to sign-in
// - Failed sign out shows a generic message and stays put
// - Escape and overlay click close the menu and return focus to Account
// - Switching to notifications does not steal focus back to Account
//
// What is covered:
// - Identity, hrefs, CSS split, sign out happy path and failure, dismiss vs switch focus
//
// Run with: pnpm test:run tests/components/account/AccountMenu.test.tsx
//
// SEE: src/components/account/AccountMenu.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

const signOut = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { signOut },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const { OpenPanelProvider, useOpenPanel } = await import('@/components/projects/OpenPanel');
const { AccountButton, AccountPopover, AccountSheet } =
  await import('@/components/account/AccountMenu');

const user = { name: 'Ada Lovelace', username: 'ada' };

function renderMenu(ui: ReactElement) {
  return render(<OpenPanelProvider>{ui}</OpenPanelProvider>);
}

function NotificationsSwitch() {
  const { setOpenPanel } = useOpenPanel();
  return (
    <button type="button" onClick={() => setOpenPanel('notifications')}>
      Notifications
    </button>
  );
}

function AccountShell({ showName = false }: { showName?: boolean }) {
  return (
    <div className="relative">
      <NotificationsSwitch />
      <AccountButton user={user} showName={showName} />
      <AccountPopover user={user} />
      <AccountSheet user={user} />
    </div>
  );
}

async function openMenu() {
  const events = userEvent.setup();
  await events.click(screen.getByRole('button', { name: 'Account' }));
  return events;
}

describe('AccountMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('shows the session name and @username after opening', async () => {
    renderMenu(<AccountShell showName />);
    await openMenu();

    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.getAllByText('@ada').length).toBeGreaterThan(0);
  });

  it('wires the three account tab links', async () => {
    renderMenu(<AccountShell />);
    await openMenu();

    expect(screen.getAllByRole('link', { name: 'Profile' })[0]).toHaveAttribute(
      'href',
      '/account?tab=profile',
    );
    expect(screen.getAllByRole('link', { name: 'Visibility' })[0]).toHaveAttribute(
      'href',
      '/account?tab=visibility',
    );
    expect(screen.getAllByRole('link', { name: 'Activity' })[0]).toHaveAttribute(
      'href',
      '/account?tab=activity',
    );
    expect(screen.queryByRole('link', { name: 'Cards' })).not.toBeInTheDocument();
  });

  it('uses CSS-only popover and sheet chrome', async () => {
    renderMenu(<AccountShell />);
    await openMenu();

    const dialogs = screen.getAllByRole('dialog', { name: 'Account' });
    expect(dialogs).toHaveLength(2);
    expect(dialogs.some((dialog) => dialog.className.includes('hidden md:block'))).toBe(true);
    expect(dialogs.some((dialog) => dialog.className.includes('w-[236px]'))).toBe(true);
    expect(dialogs.some((dialog) => dialog.className.includes('md:hidden'))).toBe(true);
  });

  it('signs the user out, redirects to the sign in page and refreshes the route', async () => {
    const events = userEvent.setup();
    renderMenu(<AccountShell />);
    await events.click(screen.getByRole('button', { name: 'Account' }));
    await events.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/sign-in');
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a generic message and stays put when sign out fails', async () => {
    const leakyMessage = 'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused';
    signOut.mockResolvedValue({
      data: null,
      error: { message: leakyMessage, status: 500, statusText: 'Internal Server Error' },
    });
    const events = userEvent.setup();
    renderMenu(<AccountShell />);
    await events.click(screen.getByRole('button', { name: 'Account' }));
    await events.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);

    expect(await screen.findAllByRole('alert')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textContent: 'Could not sign out. Please try again.',
        }),
      ]),
    );
    expect(screen.getAllByRole('alert')[0]).not.toHaveTextContent('10.0.0.5');
    expect(push).not.toHaveBeenCalled();
  });

  it('closes on Escape and returns focus to the Account button', async () => {
    const events = userEvent.setup();
    renderMenu(<AccountShell />);
    const trigger = screen.getByRole('button', { name: 'Account' });
    await events.click(trigger);
    expect(screen.getAllByRole('dialog', { name: 'Account' }).length).toBeGreaterThan(0);

    await events.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on overlay click and returns focus to the Account button', async () => {
    const events = userEvent.setup();
    const { container } = renderMenu(<AccountShell />);
    const trigger = screen.getByRole('button', { name: 'Account' });
    await events.click(trigger);

    const overlay = container.querySelector('.fixed.inset-0.z-40');
    expect(overlay).not.toBeNull();
    await events.click(overlay!);

    expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('leaves focus on the notifications button when switching away from the menu', async () => {
    const events = userEvent.setup();
    renderMenu(<AccountShell />);
    const account = screen.getByRole('button', { name: 'Account' });
    const bell = screen.getByRole('button', { name: 'Notifications' });

    await events.click(account);
    await events.click(bell);

    expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
    expect(account).not.toHaveFocus();
  });
});
