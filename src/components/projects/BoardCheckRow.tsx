import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';

export default function BoardCheckRow({
  checked,
  onToggle,
  children,
  className,
  boxClassName,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  boxClassName?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={cn(
        shellFocusClassName,
        'flex items-center gap-2.5 p-0 text-left text-[13px] text-foreground',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-[9px] text-primary-foreground',
          checked ? 'border-foreground bg-foreground' : 'border-border-strong bg-transparent',
          boxClassName,
        )}
      >
        {checked ? '✓' : ''}
      </span>
      {children}
    </button>
  );
}
