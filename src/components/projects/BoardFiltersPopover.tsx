'use client';

import { Filter } from 'lucide-react';

import BoardCheckRow from '@/components/projects/BoardCheckRow';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import { shellFocusClassName } from '@/components/projects/shell';
import type { BoardFilters } from '@/lib/boardView';
import { activeFilterGroupCount, emptyBoardFilters } from '@/lib/boardView';
import { labelToneClasses } from '@/lib/labelTones';
import type { LabelView } from '@/lib/labels';
import { cn } from '@/lib/utils';

export default function BoardFiltersPopover({
  labels,
  filters,
  onChange,
}: {
  labels: LabelView[];
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
}) {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const open = openPanel === 'filters';
  const count = activeFilterGroupCount(filters);
  const active = count > 0;

  function toggle() {
    setOpenPanel(open ? null : 'filters');
  }

  function toggleLabel(id: string) {
    const selected = filters.labelIds.includes(id);
    onChange({
      ...filters,
      labelIds: selected
        ? filters.labelIds.filter((item) => item !== id)
        : [...filters.labelIds, id],
    });
  }

  function clear() {
    onChange(emptyBoardFilters());
    setOpenPanel(null);
  }

  return (
    <div className="relative flex">
      <button
        type="button"
        aria-label="Filters"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Filters"
        onClick={toggle}
        className={cn(
          shellFocusClassName,
          'inline-flex items-center justify-center gap-1.5 rounded-md border',
          'h-10 min-w-10 px-[11px] tablet:h-[38px] lg:h-9',
          active || open
            ? 'border-border-strong bg-card text-foreground'
            : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
        )}
      >
        <Filter className="size-4" strokeWidth={1.9} />
        {active ? (
          <span className="rounded-full bg-foreground px-1.5 py-px text-[11px] font-semibold text-primary-foreground">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close filters"
            className="fixed inset-0 z-40 hidden cursor-default tablet:block"
            onClick={() => setOpenPanel(null)}
          />
          <div
            role="dialog"
            aria-label="Filters"
            className="absolute top-[calc(100%+8px)] right-0 z-50 hidden w-[268px] flex-col gap-3.5 rounded-[12px] border border-border-strong bg-surface p-4 shadow-[0_20px_50px_oklch(0_0_0/0.55)] tablet:flex"
          >
            <FiltersBody
              labels={labels}
              filters={filters}
              onToggleLabel={toggleLabel}
              onToggleMine={() => onChange({ ...filters, onlyMine: !filters.onlyMine })}
              onToggleOverdue={() => onChange({ ...filters, onlyOverdue: !filters.onlyOverdue })}
              onClear={clear}
            />
          </div>
          <div className="fixed inset-0 z-50 flex flex-col justify-end tablet:hidden">
            <button
              type="button"
              aria-label="Close filters"
              className="absolute inset-0 cursor-default bg-black/10"
              onClick={() => setOpenPanel(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              className="relative z-10 flex max-h-[78%] flex-col gap-5 rounded-t-[22px] border-t border-border-strong bg-surface px-4 pt-2 pb-[26px] shadow-[0_-22px_60px_oklch(0_0_0/0.6)]"
            >
              <div className="flex items-center px-1 pt-2">
                <span className="mr-auto text-[15px] font-semibold">Filters</span>
                <button
                  type="button"
                  aria-label="Close filters"
                  onClick={() => setOpenPanel(null)}
                  className={cn(shellFocusClassName, 'text-[13px] text-muted-foreground')}
                >
                  Close
                </button>
              </div>
              <FiltersBody
                labels={labels}
                filters={filters}
                compact={false}
                onToggleLabel={toggleLabel}
                onToggleMine={() => onChange({ ...filters, onlyMine: !filters.onlyMine })}
                onToggleOverdue={() => onChange({ ...filters, onlyOverdue: !filters.onlyOverdue })}
                onClear={clear}
                onApply={() => setOpenPanel(null)}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FiltersBody({
  labels,
  filters,
  compact = true,
  onToggleLabel,
  onToggleMine,
  onToggleOverdue,
  onClear,
  onApply,
}: {
  labels: LabelView[];
  filters: BoardFilters;
  compact?: boolean;
  onToggleLabel: (id: string) => void;
  onToggleMine: () => void;
  onToggleOverdue: () => void;
  onClear: () => void;
  onApply?: () => void;
}) {
  return (
    <>
      <div className={cn('flex flex-col', compact ? 'gap-2.5' : 'gap-2.5')}>
        <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Label
        </span>
        <div className={cn('flex flex-wrap', compact ? 'gap-1.5' : 'gap-1.5')}>
          {labels.map((label) => {
            const selected = filters.labelIds.includes(label.id);
            const tone = labelToneClasses(label.tone);
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggleLabel(label.id)}
                className={cn(
                  shellFocusClassName,
                  'rounded-full border px-[11px] py-1 text-[11.5px] font-medium',
                  compact ? '' : 'px-3.5 py-2 text-[12.5px]',
                  selected ? tone.chip : 'border-border bg-transparent text-muted-foreground',
                )}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className={cn(
          'flex flex-col border-t border-border',
          compact ? 'gap-2.5 pt-3' : 'gap-0.5 pt-1',
        )}
      >
        <BoardCheckRow
          checked={filters.onlyMine}
          onToggle={onToggleMine}
          className={compact ? undefined : 'h-[52px] gap-3 text-[14.5px]'}
          boxClassName={compact ? undefined : 'size-5 rounded-md text-[11px]'}
        >
          Only my cards
        </BoardCheckRow>
        <BoardCheckRow
          checked={filters.onlyOverdue}
          onToggle={onToggleOverdue}
          className={compact ? undefined : 'h-[52px] gap-3 text-[14.5px]'}
          boxClassName={compact ? undefined : 'size-5 rounded-md text-[11px]'}
        >
          Only overdue
        </BoardCheckRow>
      </div>
      {onApply ? (
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClear}
            className={cn(
              shellFocusClassName,
              'h-[46px] flex-1 rounded-md border border-border-strong text-[13.5px] font-medium',
            )}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onApply}
            className={cn(
              shellFocusClassName,
              'h-[46px] flex-1 rounded-md bg-primary text-[13.5px] font-semibold text-primary-foreground',
            )}
          >
            Apply
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onClear}
          className={cn(
            shellFocusClassName,
            'self-start p-0 text-[12.5px] text-muted-foreground underline decoration-solid underline-offset-[3px] hover:text-foreground',
          )}
        >
          Clear filters
        </button>
      )}
    </>
  );
}
