// tests/components/cards/DueDateField.test.tsx
//
// Tests for the shared due date and time control.
//
// Tested:
// - Splits and joins a due value across the date and time inputs
// - A date alone stays a calendar day
// - Typing a time upgrades the value to a moment
// - Clearing the time returns the value to a calendar day
// - Clearing the date clears the time with it
// - The time input is disabled until a date is picked
// - The clear button appears only while a time is set
// - Names the zone a save would record while a time is set
// - Shows the late tone and the error, and locks both inputs without edit rights
//
// What is covered:
// - Rendering, entering a time, clearing a time, the day-only default, zone hint,
//   error and read-only states
//
// Run with: pnpm test:run tests/components/cards/DueDateField.test.tsx
//
// SEE: src/components/cards/DueDateField.tsx

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DueDateField, { joinDueValue, splitDueValue } from '@/components/cards/DueDateField';

function setup(value: string, props: Partial<React.ComponentProps<typeof DueDateField>> = {}) {
  const onChange = vi.fn();
  render(<DueDateField idPrefix="due" value={value} onChange={onChange} {...props} />);
  return { onChange };
}

describe('splitDueValue and joinDueValue', () => {
  it('round-trips a calendar day and a moment', () => {
    expect(splitDueValue('')).toEqual({ day: '', time: '' });
    expect(splitDueValue('2026-08-25')).toEqual({ day: '2026-08-25', time: '' });
    expect(splitDueValue('2026-08-25T14:30')).toEqual({ day: '2026-08-25', time: '14:30' });

    expect(joinDueValue('', '14:30')).toBe('');
    expect(joinDueValue('2026-08-25', '')).toBe('2026-08-25');
    expect(joinDueValue('2026-08-25', '14:30')).toBe('2026-08-25T14:30');
  });
});

describe('DueDateField', () => {
  it('shows a date alone as a calendar day with an empty time', () => {
    setup('2026-08-25');

    expect(screen.getByLabelText('Due date')).toHaveValue('2026-08-25');
    expect(screen.getByLabelText('Due time')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear time' })).not.toBeInTheDocument();
  });

  it('disables the time input until a date is picked', () => {
    setup('');

    expect(screen.getByLabelText('Due time')).toBeDisabled();
  });

  it('upgrades the value to a moment when a time is entered', () => {
    const { onChange } = setup('2026-08-25');

    // The input is controlled, so a whole time arrives as one change.
    fireEvent.change(screen.getByLabelText('Due time'), { target: { value: '14:30' } });

    expect(onChange).toHaveBeenLastCalledWith('2026-08-25T14:30');
  });

  it('returns the value to a calendar day when the time is cleared', async () => {
    const user = userEvent.setup();
    const { onChange } = setup('2026-08-25T14:30');

    await user.click(screen.getByRole('button', { name: 'Clear time' }));

    expect(onChange).toHaveBeenCalledWith('2026-08-25');
  });

  it('clears the time along with the date, since a time needs a day', () => {
    const { onChange } = setup('2026-08-25T14:30');

    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('names the zone a save would record only while a time is set', () => {
    const { rerender } = render(
      <DueDateField
        idPrefix="due"
        value="2026-08-25"
        onChange={vi.fn()}
        hintTimeZone="Europe/Madrid"
      />,
    );
    expect(screen.queryByText(/Set in/)).not.toBeInTheDocument();

    rerender(
      <DueDateField
        idPrefix="due"
        value="2026-08-25T14:30"
        onChange={vi.fn()}
        hintTimeZone="Europe/Madrid"
      />,
    );
    expect(screen.getByText(/^Set in Madrid time \(GMT[+-]\d{2}:\d{2}\)$/)).toBeInTheDocument();
  });

  it('shows the late tone on both inputs and reports the error', () => {
    setup('2026-08-25T14:30', { late: true, error: 'Enter a valid time' });

    expect(screen.getByLabelText('Due date')).toHaveClass('text-late');
    expect(screen.getByLabelText('Due time')).toHaveClass('text-late');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid time');
  });

  it('locks both inputs and hides the clear button without edit rights', () => {
    setup('2026-08-25T14:30', { canEdit: false });

    expect(screen.getByLabelText('Due date')).toBeDisabled();
    expect(screen.getByLabelText('Due time')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Clear time' })).not.toBeInTheDocument();
  });
});
