'use client';

import { X } from 'lucide-react';

import { shellFocusClassName } from '@/components/projects/shell';
import { describeTimeZone } from '@/lib/cardDue';
import { cn } from '@/lib/utils';

/**
 * The due value the control edits: an empty string, a calendar day, or a day
 * with a wall time. The time is what makes it a moment.
 */
export function splitDueValue(value: string): { day: string; time: string } {
  const separator = value.indexOf('T');
  if (separator === -1) return { day: value, time: '' };
  return { day: value.slice(0, separator), time: value.slice(separator + 1) };
}

export function joinDueValue(day: string, time: string): string {
  if (day === '') return '';
  return time === '' ? day : `${day}T${time}`;
}

const INPUT_CLASSES = {
  panel:
    'h-10 rounded-md border border-border bg-background px-3 text-sm tablet:h-9 tablet:bg-surface tablet:text-[13px]',
  form: 'h-11 rounded-md border border-input bg-background px-[13px] text-[14.5px] tablet:h-[38px] tablet:px-3 tablet:text-[13.5px]',
} as const;

export default function DueDateField({
  idPrefix,
  value,
  onChange,
  onBlur,
  variant = 'panel',
  canEdit = true,
  error,
  late = false,
  hintTimeZone = null,
}: {
  idPrefix: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  variant?: keyof typeof INPUT_CLASSES;
  canEdit?: boolean;
  error?: string;
  late?: boolean;
  /** The zone a save would record, named under the inputs while a time is set. */
  hintTimeZone?: string | null;
}) {
  const { day, time } = splitDueValue(value);
  const inputClass = INPUT_CLASSES[variant];
  const toneClass = late ? 'text-late' : 'text-foreground';

  function handleDayChange(nextDay: string) {
    if (!canEdit) return;
    // A time with no day has nothing to happen on.
    onChange(joinDueValue(nextDay, nextDay === '' ? '' : time));
  }

  function handleTimeChange(nextTime: string) {
    if (!canEdit) return;
    onChange(joinDueValue(day, nextTime));
  }

  return (
    <div className="flex flex-col gap-2 tablet:gap-[7px]">
      <div className="flex flex-col gap-2 tablet:flex-row tablet:items-center">
        <input
          id={`${idPrefix}-date`}
          type="date"
          aria-label="Due date"
          value={day}
          readOnly={!canEdit}
          disabled={!canEdit}
          aria-invalid={Boolean(error)}
          onChange={(event) => handleDayChange(event.target.value)}
          onBlur={onBlur}
          className={cn(shellFocusClassName, inputClass, toneClass, 'w-full min-w-0 tablet:flex-1')}
        />
        <div className="flex items-center gap-2">
          <input
            id={`${idPrefix}-time`}
            type="time"
            aria-label="Due time"
            value={time}
            readOnly={!canEdit}
            disabled={!canEdit || day === ''}
            aria-invalid={Boolean(error)}
            onChange={(event) => handleTimeChange(event.target.value)}
            onBlur={onBlur}
            className={cn(
              shellFocusClassName,
              inputClass,
              toneClass,
              'min-w-0 flex-1 disabled:opacity-50 tablet:w-[104px] tablet:flex-none tablet:shrink-0',
            )}
          />
          {canEdit && time !== '' ? (
            <button
              type="button"
              aria-label="Clear time"
              onClick={() => handleTimeChange('')}
              onBlur={onBlur}
              className={cn(
                shellFocusClassName,
                'inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground',
              )}
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>
      {time !== '' && hintTimeZone ? (
        <p className="text-[11.5px] text-muted-foreground">
          Set in {describeTimeZone(hintTimeZone)}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
