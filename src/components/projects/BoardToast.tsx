'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

const TOAST_MS = 5000;

export type BoardToastMessage = {
  message: string;
  role: 'status' | 'alert';
};

export default function BoardToast({
  toast,
  onDismiss,
}: {
  toast: BoardToastMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => onDismiss(), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role={toast.role}
      className={cn(
        'fixed z-[90] flex items-center gap-3.5 rounded-md border border-border-strong bg-card',
        'px-4 py-[11px] pr-3.5 text-[13.5px] text-foreground shadow-[0_18px_44px_oklch(0_0_0/0.55)]',
        'inset-x-4 bottom-24 tablet:inset-x-auto tablet:bottom-[26px] tablet:left-1/2 tablet:w-max tablet:-translate-x-1/2 tablet:text-[13px]',
      )}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className={cn(
          shellFocusClassName,
          'inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-card-hover hover:text-foreground',
        )}
      >
        <X className="size-3.5" strokeWidth={1.8} />
      </button>
    </div>
  );
}
