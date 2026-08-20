// tests/components/account/ActiveStatusProvider.test.tsx
//
// Tests for the live active-status context used by the account header pill.
//
// Tested:
// - setActive updates consumers without a reload
// - Falls back when no provider is mounted
//
// What is covered:
// - Live status name and color
//
// Run with: pnpm test:run tests/components/account/ActiveStatusProvider.test.tsx
//
// SEE: src/components/account/ActiveStatusProvider.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActiveStatusProvider, useActiveStatus } from '@/components/account/ActiveStatusProvider';
import AccountStatusPill from '@/components/account/AccountStatusPill';

function Probe() {
  const { status, setActive } = useActiveStatus();
  return (
    <div>
      <p>id:{status.id}</p>
      <button
        type="button"
        onClick={() => setActive({ id: 's2', name: 'Inactive', color: 'gray' })}
      >
        select-inactive
      </button>
      <AccountStatusPill />
    </div>
  );
}

describe('ActiveStatusProvider', () => {
  it('updates the pill when the active status changes', async () => {
    const events = userEvent.setup();
    render(
      <ActiveStatusProvider initial={{ id: 's1', name: 'Active', color: 'green' }}>
        <Probe />
      </ActiveStatusProvider>,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    await events.click(screen.getByRole('button', { name: 'select-inactive' }));
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('id:s2')).toBeInTheDocument();
  });

  it('falls back when no provider is mounted', () => {
    render(<Probe />);
    expect(screen.getByText('id:')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });
});
