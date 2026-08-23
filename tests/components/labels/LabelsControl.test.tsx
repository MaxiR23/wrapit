// tests/components/labels/LabelsControl.test.tsx
//
// Tests for the board-header labels trigger and panel chrome.
//
// Tested:
// - Opening Labels shows the editor in a dialog
// - Done closes the panel
// - An edit in the popover is visible in the sheet while the panel stays open
//
// What is covered:
// - Open, editor present, done dismiss, shared editor state across chromes
//
// Run with: pnpm test:run tests/components/labels/LabelsControl.test.tsx
//
// SEE: src/components/labels/LabelsControl.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LabelsControl from '@/components/labels/LabelsControl';
import { OpenPanelProvider } from '@/components/projects/OpenPanel';
import type { LabelView } from '@/lib/labels';

vi.mock('@/actions/updateLabelField', () => ({
  updateLabelField: vi.fn(async (input: { value: string }) => ({ data: { value: input.value } })),
}));
vi.mock('@/actions/createLabel', () => ({ createLabel: vi.fn() }));
vi.mock('@/actions/deleteLabel', () => ({ deleteLabel: vi.fn() }));

const labels: LabelView[] = [{ id: 'l0', name: 'Design', tone: 'blue', order: 0 }];

describe('LabelsControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the editor in a dialog and closes it from Done', async () => {
    const events = userEvent.setup();
    render(
      <OpenPanelProvider>
        <LabelsControl projectId="project-1" labels={labels} />
      </OpenPanelProvider>,
    );

    expect(screen.queryByRole('dialog', { name: 'Labels' })).not.toBeInTheDocument();

    await events.click(screen.getByRole('button', { name: 'Labels' }));
    expect(screen.getAllByRole('dialog', { name: 'Labels' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('textbox', { name: 'Design name' }).length).toBeGreaterThan(0);

    await events.click(screen.getAllByRole('button', { name: 'Done' })[0]!);
    expect(screen.queryByRole('dialog', { name: 'Labels' })).not.toBeInTheDocument();
  });

  it('reflects an edit from one variant in the other while the panel stays open', async () => {
    const events = userEvent.setup();
    render(
      <OpenPanelProvider>
        <LabelsControl projectId="project-1" labels={labels} />
      </OpenPanelProvider>,
    );

    await events.click(screen.getByRole('button', { name: 'Labels' }));

    const inputs = screen.getAllByRole('textbox', { name: 'Design name' });
    expect(inputs).toHaveLength(2);

    await events.type(inputs[0]!, 'ed');

    expect(inputs[0]).toHaveValue('Designed');
    expect(inputs[1]).toHaveValue('Designed');
    expect(screen.getAllByRole('dialog', { name: 'Labels' })).toHaveLength(2);
  });
});
