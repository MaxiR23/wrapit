'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';

export const PROFILE_AUTOSAVE_DEBOUNCE_MS = 400;

type SaveResult =
  { data: unknown } | { error: string } | { fieldErrors: Record<string, string | undefined> };

/** Prefer the stored value the action returned (trimmed, normalized). */
function storedFromData<T>(data: unknown, intended: T): T {
  if (typeof data === 'object' && data !== null) {
    if ('value' in data) return (data as { value: T }).value;
    if ('visibility' in data) return (data as { visibility: T }).visibility;
  }
  return data === undefined || data === null ? intended : (data as T);
}

export function useProfileAutosave<T>({
  initial,
  save,
  debounceMs = PROFILE_AUTOSAVE_DEBOUNCE_MS,
  onSuccess,
  onRevert,
}: {
  initial: T;
  save: (value: T) => Promise<SaveResult>;
  debounceMs?: number;
  onSuccess?: (value: T) => void;
  onRevert?: (value: T) => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const desiredRef = useRef(initial);
  const persistedRef = useRef(initial);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  const onSuccessRef = useRef(onSuccess);
  const onRevertRef = useRef(onRevert);

  useEffect(() => {
    saveRef.current = save;
    onSuccessRef.current = onSuccess;
    onRevertRef.current = onRevert;
  });

  const persist = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const run = (async () => {
      try {
        while (desiredRef.current !== persistedRef.current) {
          const intended = desiredRef.current;
          const result = await saveRef.current(intended);
          if ('fieldErrors' in result) {
            const message =
              result.fieldErrors.value ?? result.fieldErrors.field ?? GENERIC_ERROR_MESSAGE;
            desiredRef.current = persistedRef.current;
            setValue(persistedRef.current);
            setError(message);
            onRevertRef.current?.(persistedRef.current);
            return;
          }
          if ('error' in result) {
            throw new Error(result.error);
          }
          const stored = storedFromData(result.data, intended);
          persistedRef.current = stored;
          if (desiredRef.current === intended) {
            desiredRef.current = stored;
            setValue(stored);
            onSuccessRef.current?.(stored);
          }
        }
        setError(null);
      } catch {
        desiredRef.current = persistedRef.current;
        setValue(persistedRef.current);
        setError(GENERIC_ERROR_MESSAGE);
        onRevertRef.current?.(persistedRef.current);
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return persist();
  }, [persist]);

  const schedule = useCallback(
    (next: T) => {
      desiredRef.current = next;
      setValue(next);
      setError(null);
      if (debounceMs <= 0) {
        void persist();
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persist();
      }, debounceMs);
    },
    [debounceMs, persist],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (desiredRef.current !== persistedRef.current) {
        void persist();
      }
    };
  }, [persist]);

  return { value, error, setValue: schedule, flush };
}
