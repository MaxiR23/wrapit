// tests/components/projects/OpenPanel.test.tsx
//
// Tests for the shell openPanel exclusion context.
//
// Tested:
// - Opening notifications then setting account closes notifications
//
// What is covered:
// - Mutual exclusion between panel ids
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
    </div>
  );
}

describe('OpenPanelProvider', () => {
  it('closes notifications when the account panel opens', async () => {
    const events = userEvent.setup();
    render(
      <OpenPanelProvider>
        <Probe />
      </OpenPanelProvider>,
    );

    await events.click(screen.getByRole('button', { name: 'Open notifications' }));
    expect(screen.getByText('panel:notifications')).toBeInTheDocument();

    await events.click(screen.getByRole('button', { name: 'Open account' }));
    expect(screen.getByText('panel:account')).toBeInTheDocument();
    expect(screen.queryByText('panel:notifications')).not.toBeInTheDocument();
  });
});
