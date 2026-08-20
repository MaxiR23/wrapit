// tests/components/account/useProfileAutosave.test.tsx
//
// Tests for per-field profile autosave: debounce, coalescing, and revert on error.
//
// Tested:
// - Debounces text saves so rapid edits send the latest value once
// - Coalesces overlapping writes so a slow response cannot overwrite a newer value
// - Does not report success for a value that is no longer desired
// - Applies the stored (trimmed) value the action returned
// - Reverts to the last persisted value when the save fails
//
// What is covered:
// - Debounce, in-flight coalescing, stored-value apply, failure revert
//
// Run with: pnpm test:run tests/components/account/useProfileAutosave.test.tsx
//
// SEE: src/components/account/useProfileAutosave.ts

import { describe, it, expect, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  PROFILE_AUTOSAVE_DEBOUNCE_MS,
  useProfileAutosave,
} from '@/components/account/useProfileAutosave';

function Probe({
  save,
  debounceMs,
  onSuccess,
}: {
  save: (value: string) => Promise<{ data: { value: string } } | { error: string }>;
  debounceMs?: number;
  onSuccess?: (value: string) => void;
}) {
  const field = useProfileAutosave({ initial: 'Ada', save, debounceMs, onSuccess });
  return (
    <div>
      <p>value:{field.value}</p>
      <button type="button" onClick={() => field.setValue('Ada Lovelace')}>
        set-long
      </button>
      <button type="button" onClick={() => field.setValue('A')}>
        set-a
      </button>
      <button type="button" onClick={() => field.setValue('AB')}>
        set-ab
      </button>
      <button type="button" onClick={() => field.setValue('  Ada Lovelace  ')}>
        set-padded
      </button>
      {field.error ? <p role="alert">{field.error}</p> : null}
    </div>
  );
}

describe('useProfileAutosave', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces so only the latest value is saved', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (value: string) => ({ data: { value } }));
    render(<Probe save={save} />);

    fireEvent.click(screen.getByRole('button', { name: 'set-long' }));
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(PROFILE_AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('Ada Lovelace');
  });

  it('writes the latest desired value after a slow in-flight save', async () => {
    let releaseFirst: (value: { data: { value: string } }) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ data: { value: string } }>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockImplementation(async (value: string) => ({ data: { value } }));

    render(<Probe save={save} debounceMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'set-a' }));
    expect(save).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'set-ab' }));
    expect(save).toHaveBeenCalledTimes(1);

    releaseFirst({ data: { value: 'A' } });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith('AB');
  });

  it('does not call onSuccess for a completed value that is no longer desired', async () => {
    const onSuccess = vi.fn();
    let releaseFirst: (value: { data: { value: string } }) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ data: { value: string } }>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockImplementation(async (value: string) => ({ data: { value } }));

    render(<Probe save={save} debounceMs={0} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'set-a' }));
    fireEvent.click(screen.getByRole('button', { name: 'set-ab' }));
    releaseFirst({ data: { value: 'A' } });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('AB'));
    expect(onSuccess).not.toHaveBeenCalledWith('A');
  });

  it('applies the stored value the action returned, not the raw typed value', async () => {
    const onSuccess = vi.fn();
    const save = vi.fn(async (value: string) => ({ data: { value: value.trim() } }));
    render(<Probe save={save} debounceMs={0} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'set-padded' }));

    await waitFor(() => expect(screen.getByText('value:Ada Lovelace')).toBeInTheDocument());
    expect(save).toHaveBeenCalledWith('  Ada Lovelace  ');
    expect(onSuccess).toHaveBeenCalledWith('Ada Lovelace');
  });

  it('reverts to the last persisted value when the save fails', async () => {
    const save = vi.fn(async () => ({ error: 'Something went wrong. Please try again.' }));
    render(<Probe save={save} debounceMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'set-a' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('value:Ada')).toBeInTheDocument();
  });
});
