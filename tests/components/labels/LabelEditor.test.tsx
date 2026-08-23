// tests/components/labels/LabelEditor.test.tsx
//
// Tests for the reusable project label editor.
//
// Tested:
// - Renders a row per label with a swatch, name, and remove control
// - The last remaining label cannot be removed
// - Typing a name does not remount the input
// - Clicking the swatch cycles the tone through the catalog
// - New label appends the row the action returns
// - Done calls onDone
// - Renaming patches the parent list so the same id is reused
//
// What is covered:
// - Rows, last-label guard, focus, tone cycle, add, done, rename identity
//
// Run with: pnpm test:run tests/components/labels/LabelEditor.test.tsx
//
// SEE: src/components/labels/LabelEditor.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import type { LabelView } from '@/lib/labels';

const updateLabelField = vi.fn();
const createLabel = vi.fn();
const deleteLabel = vi.fn();

vi.mock('@/actions/updateLabelField', () => ({
  updateLabelField: (...args: unknown[]) => updateLabelField(...args),
}));
vi.mock('@/actions/createLabel', () => ({
  createLabel: (...args: unknown[]) => createLabel(...args),
}));
vi.mock('@/actions/deleteLabel', () => ({
  deleteLabel: (...args: unknown[]) => deleteLabel(...args),
}));

const { default: LabelEditor } = await import('@/components/labels/LabelEditor');

const labels: LabelView[] = [
  { id: 'l0', name: 'Design', tone: 'blue', order: 0 },
  { id: 'l1', name: 'Bug', tone: 'red', order: 1 },
];

function StatefulEditor({
  initialLabels,
  onDone,
  onLabelsChange,
}: {
  initialLabels: LabelView[];
  onDone: () => void;
  onLabelsChange?: (labels: LabelView[]) => void;
}) {
  const [labels, setLabels] = useState(initialLabels);
  return (
    <LabelEditor
      projectId="project-1"
      labels={labels}
      onDone={onDone}
      onLabelsChange={(next) => {
        setLabels(next);
        onLabelsChange?.(next);
      }}
    />
  );
}

function renderEditor(onDone = vi.fn(), onLabelsChange = vi.fn()) {
  return {
    onDone,
    onLabelsChange,
    ...render(
      <StatefulEditor initialLabels={labels} onDone={onDone} onLabelsChange={onLabelsChange} />,
    ),
  };
}

describe('LabelEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateLabelField.mockImplementation(async (input: { value: string }) => ({
      data: { value: input.value },
    }));
    createLabel.mockResolvedValue({
      data: { id: 'l2', name: 'Label 3', tone: 'amber', order: 2 },
    });
    deleteLabel.mockResolvedValue({ data: { id: 'l1', replacementId: 'l0' } });
  });

  it('renders a name input and remove control for each label', () => {
    renderEditor();

    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Design');
    expect(screen.getByRole('textbox', { name: 'Bug name' })).toHaveValue('Bug');
    expect(screen.getByRole('button', { name: 'Remove Design' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove Bug' })).toBeEnabled();
  });

  it('disables remove when only one label remains', () => {
    render(<LabelEditor projectId="project-1" labels={[labels[0]!]} onDone={() => {}} />);

    expect(screen.getByRole('button', { name: 'Remove Design' })).toBeDisabled();
  });

  it('does not lose focus while typing a label name', async () => {
    const events = userEvent.setup();
    renderEditor();

    const input = screen.getByRole('textbox', { name: 'Design name' });
    await events.click(input);
    await events.type(input, ' now');

    expect(input).toHaveFocus();
    expect(input).toHaveValue('Design now');
  });

  it('cycles color through the palette', async () => {
    const events = userEvent.setup();
    renderEditor();

    await events.click(screen.getAllByRole('button', { name: 'Change color' })[0]!);

    expect(updateLabelField).toHaveBeenCalledWith({
      labelId: 'l0',
      field: 'tone',
      value: 'green',
    });
  });

  it('appends a new label from the action result', async () => {
    const events = userEvent.setup();
    const { onLabelsChange } = renderEditor();

    await events.click(screen.getByRole('button', { name: 'New label' }));

    expect(createLabel).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(screen.getByRole('textbox', { name: 'Label 3 name' })).toBeInTheDocument();
    expect(onLabelsChange).toHaveBeenCalledWith([
      ...labels,
      { id: 'l2', name: 'Label 3', tone: 'amber', order: 2 },
    ]);
  });

  it('calls onDone from the Done button', async () => {
    const events = userEvent.setup();
    const { onDone } = renderEditor();

    await events.click(screen.getByRole('button', { name: 'Done' }));

    expect(onDone).toHaveBeenCalled();
  });

  it('removes a label and keeps the remaining row', async () => {
    const events = userEvent.setup();
    const { onLabelsChange } = renderEditor();

    await events.click(screen.getByRole('button', { name: 'Remove Bug' }));

    expect(deleteLabel).toHaveBeenCalledWith({ labelId: 'l1' });
    expect(screen.queryByRole('textbox', { name: 'Bug name' })).not.toBeInTheDocument();
    expect(onLabelsChange.mock.calls.at(-1)?.[0]).toEqual([labels[0]]);
  });

  it('keeps the row identity when renaming so the input is not remounted', async () => {
    const events = userEvent.setup();
    const { onLabelsChange } = renderEditor();

    const input = screen.getByRole('textbox', { name: 'Design name' });
    await events.type(input, 'ed');

    expect(onLabelsChange).toHaveBeenCalled();
    const last = onLabelsChange.mock.calls.at(-1)?.[0] as LabelView[];
    expect(last[0]?.id).toBe('l0');
    expect(input).toHaveFocus();
  });
});
