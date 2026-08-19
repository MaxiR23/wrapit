'use client';

import { Check } from 'lucide-react';

import { shellFocusClassName } from '@/components/projects/shell';
import type { ProjectTemplate } from '@/lib/templates';
import { cn } from '@/lib/utils';

export default function ProjectTemplateRow({
  template,
  selected,
  onSelect,
  layout = 'grid',
}: {
  template: ProjectTemplate;
  selected: boolean;
  onSelect: () => void;
  layout?: 'grid' | 'stack';
}) {
  const stacked = layout === 'stack';

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        shellFocusClassName,
        'flex min-w-0 items-center gap-3 rounded-[11px] border px-[13px] text-left',
        stacked ? 'min-h-14 py-[9px]' : 'min-h-[54px] py-[9px] lg:min-h-[52px] lg:py-2',
        selected
          ? 'border-foreground bg-card-hover'
          : 'border-border bg-transparent hover:border-border-strong',
      )}
    >
      <span className="mr-auto flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            'font-semibold text-foreground',
            stacked ? 'text-[14.5px]' : 'text-sm lg:text-[13.5px]',
          )}
        >
          {template.name}
        </span>
        <span
          className={cn(
            'truncate whitespace-nowrap text-muted-foreground',
            stacked ? 'text-xs' : 'text-[11.5px]',
          )}
        >
          {template.columns.join(' · ')}
        </span>
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border',
          stacked ? 'size-5' : 'size-[19px] lg:size-[18px]',
          selected ? 'border-foreground text-foreground' : 'border-border text-transparent',
        )}
      >
        {selected ? (
          <Check className={stacked ? 'size-3' : 'size-[10.5px] lg:size-2.5'} strokeWidth={2.4} />
        ) : null}
      </span>
    </button>
  );
}
