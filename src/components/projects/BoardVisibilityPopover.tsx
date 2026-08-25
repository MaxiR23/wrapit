'use client';

import { Eye } from 'lucide-react';

import BoardCheckRow from '@/components/projects/BoardCheckRow';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import { shellFocusClassName } from '@/components/projects/shell';
import { BOARD_VISIBILITY_FIELDS, type BoardVisibility } from '@/lib/boardView';
import { cn } from '@/lib/utils';

export default function BoardVisibilityPopover({
  visibility,
  onChange,
}: {
  visibility: BoardVisibility;
  onChange: (visibility: BoardVisibility) => void;
}) {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const open = openPanel === 'visibility';

  function toggle() {
    setOpenPanel(open ? null : 'visibility');
  }

  function flip(key: keyof BoardVisibility) {
    onChange({ ...visibility, [key]: !visibility[key] });
  }

  return (
    <div className="relative flex">
      <button
        type="button"
        aria-label="Card visibility"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Card visibility"
        onClick={toggle}
        className={cn(
          shellFocusClassName,
          'inline-flex items-center justify-center rounded-md border',
          'size-10 tablet:size-[38px] lg:size-9',
          open
            ? 'border-border-strong bg-card text-foreground'
            : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
        )}
      >
        <Eye className="size-[17px]" strokeWidth={1.9} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close visibility"
            className="fixed inset-0 z-40 hidden cursor-default tablet:block"
            onClick={() => setOpenPanel(null)}
          />
          <div
            role="dialog"
            aria-label="Show on card"
            className="absolute top-[calc(100%+8px)] right-0 z-50 hidden w-[244px] flex-col gap-[11px] rounded-[12px] border border-border-strong bg-surface p-4 shadow-[0_20px_50px_oklch(0_0_0/0.55)] tablet:flex"
          >
            <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
              Show on card
            </span>
            {BOARD_VISIBILITY_FIELDS.map((field) => (
              <BoardCheckRow
                key={field.key}
                checked={visibility[field.key]}
                onToggle={() => flip(field.key)}
              >
                {field.label}
              </BoardCheckRow>
            ))}
          </div>
          <div className="fixed inset-0 z-50 flex flex-col justify-end tablet:hidden">
            <button
              type="button"
              aria-label="Close visibility"
              className="absolute inset-0 cursor-default bg-black/10"
              onClick={() => setOpenPanel(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Show on card"
              className="relative z-10 flex max-h-[78%] flex-col rounded-t-[22px] border-t border-border-strong bg-surface px-4 pt-2 pb-[26px] shadow-[0_-22px_60px_oklch(0_0_0/0.6)]"
            >
              <div className="flex items-center px-1 pt-2 pb-2">
                <span className="mr-auto text-[15px] font-semibold">Show on card</span>
                <button
                  type="button"
                  aria-label="Close visibility"
                  onClick={() => setOpenPanel(null)}
                  className={cn(shellFocusClassName, 'text-[13px] text-muted-foreground')}
                >
                  Close
                </button>
              </div>
              {BOARD_VISIBILITY_FIELDS.map((field) => {
                const on = visibility[field.key];
                return (
                  <button
                    key={field.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => flip(field.key)}
                    className={cn(
                      shellFocusClassName,
                      'flex h-[54px] items-center gap-3 border-b border-border px-0.5 text-left text-[14.5px]',
                    )}
                  >
                    <span className="mr-auto">{field.label}</span>
                    <span
                      className={cn(
                        'flex h-[26px] w-11 shrink-0 items-center rounded-full border p-0.5',
                        on
                          ? 'justify-end border-foreground bg-foreground'
                          : 'justify-start border-border-strong',
                      )}
                    >
                      <span
                        className={cn(
                          'block size-5 rounded-full',
                          on ? 'bg-primary-foreground' : 'bg-muted-foreground',
                        )}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
