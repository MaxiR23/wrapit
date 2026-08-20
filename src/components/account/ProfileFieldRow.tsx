'use client';

import type { ReactNode } from 'react';

import VisibilityDropdown from '@/components/account/VisibilityDropdown';
import { shellFocusClassName } from '@/components/projects/shell';
import type { ProfileVisibility } from '@/lib/userProfile';
import { cn } from '@/lib/utils';

export default function ProfileFieldRow({
  label,
  htmlFor,
  visibilityKey,
  visibility,
  onVisibilityChange,
  error,
  last,
  children,
}: {
  label: string;
  htmlFor?: string;
  visibilityKey: string;
  visibility: ProfileVisibility;
  onVisibilityChange: (value: ProfileVisibility) => void;
  error?: string | null;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-stretch gap-4 px-4 py-3',
        'md:grid-cols-[200px_1fr_232px] md:items-center',
        !last && 'border-b border-border',
      )}
    >
      <label htmlFor={htmlFor} className="text-[13px] text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {error ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <VisibilityDropdown
        menuKey={visibilityKey}
        label={label}
        value={visibility}
        onChange={onVisibilityChange}
      />
    </div>
  );
}

export const profileInputClassName = cn(
  shellFocusClassName,
  'h-[34px] w-full rounded-sm border border-border bg-background px-[11px] text-[13.5px] text-foreground',
  'placeholder:text-muted-foreground',
);
