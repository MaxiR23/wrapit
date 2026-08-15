'use client';

import { Star } from 'lucide-react';
import type { MouseEvent } from 'react';

import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

export type OnToggleStar = (projectId: string, starred: boolean) => void;

export default function ProjectStarButton({
  projectId,
  starred,
  className,
  onToggle,
}: {
  projectId: string;
  starred: boolean;
  className?: string;
  onToggle?: OnToggleStar;
}) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onToggle?.(projectId, !starred);
  }

  return (
    <button
      type="button"
      aria-label={starred ? 'Unstar project' : 'Star project'}
      aria-pressed={starred}
      onClick={handleClick}
      className={cn(
        shellFocusClassName,
        'inline-flex rounded-sm',
        starred ? 'text-foreground' : 'text-subtle',
        className,
      )}
    >
      <Star className="size-[15px]" strokeWidth={1.7} fill={starred ? 'currentColor' : 'none'} />
    </button>
  );
}
