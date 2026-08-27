'use client';

import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

export default function ShareConfirm({
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  confirmClassName,
  onCancel,
  onConfirm,
}: {
  title?: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: string | null;
  confirmClassName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-[9px] rounded-md border border-danger-edge bg-danger-soft p-3">
      {title ? <p className="text-[13px] font-semibold">{title}</p> : null}
      <p className="text-[12.5px] leading-[1.5] text-pretty">{description}</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className={cn(
            shellFocusClassName,
            'h-[30px] flex-1 rounded-sm border border-border-strong text-[12.5px] font-medium',
            'disabled:opacity-50',
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className={cn(
            shellFocusClassName,
            'h-[30px] flex-1 rounded-sm bg-danger text-[12.5px] font-semibold text-primary-foreground',
            'disabled:opacity-50',
            confirmClassName,
          )}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </div>
  );
}
