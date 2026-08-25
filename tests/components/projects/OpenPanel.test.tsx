// tests/components/projects/OpenPanel.test.tsx
//
// Tests for the shell openPanel exclusion context.
//
// Tested:
// - Opening notifications then setting account closes notifications
// - Opening account then setting notifications closes account
// - Opening filters then visibility or member closes filters
// - Escape closes whichever panel is open
//
// What is covered:
// - Mutual exclusion between panel ids, Escape dismiss
//
// Run with: pnpm test:run tests/components/projects/OpenPanel.test.tsx
//
// SEE: src/components/projects/OpenPanel.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OpenPanelProvider, useOpenPanel } from '@/components/projects/OpenPanel';

function Probe() {
  const { openPanel, setOpenPanel } = useOpenPanel();
  return (
    <div>
      <p>panel:{openPanel ?? 'none'}</p>
      <button type="button" onClick={() => setOpenPanel('notifications')}>
        Open notifications
      </button>
      <button type="button" onClick={() => setOpenPanel('account')}>
        Open account
      </button>
      <button type="button" onClick={() => setOpenPanel('filters')}>
        Open filters
      </button>
      <button type="button" onClick={() => setOpenPanel('visibility')}>
        Open visibility
      </button>
      <button type="button" onClick={() => setOpenPanel('member')}>
        Open member
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <OpenPanelProvider>
      <Probe />
    </OpenPanelProvider>,
  );
}

describe('OpenPanelProvider', () => {
  it('closes notifications when the account panel opens', async () => {
    const events = userEvent.setup();
    renderProbe();

    await events.click(screen.getByRole('button', { name: 'Open notifications' }));
    expect(screen.getByText('panel:notifications')).toBeInTheDocument();

    await events.click(screen.getByRole('button', { name: 'Open account' }));
    expect(screen.getByText('panel:account')).toBeInTheDocument();
    expect(screen.queryByText('panel:notifications')).not.toBeInTheDocument();
  });

  it('closes account when the notifications panel opens', async () => {
    const events = userEvent.setup();
    renderProbe();

    await events.click(screen.getByRole('button', { name: 'Open account' }));
    expect(screen.getByText('panel:account')).toBeInTheDocument();

    await events.click(screen.getByRole('button', { name: 'Open notifications' }));
    expect(screen.getByText('panel:notifications')).toBeInTheDocument();
    expect(screen.queryByText('panel:account')).not.toBeInTheDocument();
  });

  it('closes filters when visibility or a member popover opens', async () => {
    const events = userEvent.setup();
    renderProbe();

    await events.click(screen.getByRole('button', { name: 'Open filters' }));
    expect(screen.getByText('panel:filters')).toBeInTheDocument();

    await events.click(screen.getByRole('button', { name: 'Open visibility' }));
    expect(screen.getByText('panel:visibility')).toBeInTheDocument();
    expect(screen.queryByText('panel:filters')).not.toBeInTheDocument();

    await events.click(screen.getByRole('button', { name: 'Open member' }));
    expect(screen.getByText('panel:member')).toBeInTheDocument();
    expect(screen.queryByText('panel:visibility')).not.toBeInTheDocument();
  });

  it('closes the open panel on Escape', async () => {
    const events = userEvent.setup();
    renderProbe();

    await events.click(screen.getByRole('button', { name: 'Open account' }));
    expect(screen.getByText('panel:account')).toBeInTheDocument();

    await events.keyboard('{Escape}');
    expect(screen.getByText('panel:none')).toBeInTheDocument();
  });
});
