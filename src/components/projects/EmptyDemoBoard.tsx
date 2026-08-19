import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

const cardRowClassName = 'h-[26px] rounded-[6px] border border-border bg-card';
const motionNoneClassName = 'motion-reduce:!animate-none';

function DemoColumn({
  label,
  rows,
  reservedSlot = false,
  className,
}: {
  label: string;
  rows: number;
  reservedSlot?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col gap-1.5',
        'animate-empty-demo-col',
        motionNoneClassName,
        className,
      )}
    >
      <span className="text-[10.5px] leading-4 tracking-[0.03em] text-subtle">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className={cardRowClassName} />
      ))}
      {reservedSlot ? <span className="h-[26px]" /> : null}
    </div>
  );
}

export default function EmptyDemoBoard() {
  return (
    <div
      aria-hidden="true"
      className="empty-demo-board relative flex gap-2 rounded-[12px] border border-border bg-surface p-3.5 md:hidden"
    >
      <DemoColumn label="To do" rows={2} reservedSlot />
      <DemoColumn label="In progress" rows={2} className="delay-[.35s]" />
      <DemoColumn label="Done" rows={2} className="delay-[.7s]" />

      <span
        className={cn(
          'pointer-events-none absolute top-[100px] left-[14px] h-[26px] w-(--demo-card-width) rounded-[6px] border border-dashed border-border-strong opacity-0',
          'animate-empty-demo-slot',
          motionNoneClassName,
        )}
      />
      <span
        className={cn(
          'pointer-events-none absolute top-[100px] left-(--demo-ring-left) h-[26px] w-(--demo-card-width) rounded-[8px] border border-foreground opacity-0',
          'animate-empty-demo-ring',
          motionNoneClassName,
        )}
      />
      <span
        className={cn(
          'empty-demo-board-card pointer-events-none absolute top-[100px] left-[14px] flex h-[26px] w-(--demo-card-width) items-center gap-[7px] rounded-[6px] border border-border-strong bg-card-hover px-[9px]',
          'animate-empty-demo-card',
          motionNoneClassName,
        )}
      >
        <span className="h-1 flex-1 rounded-[2px] bg-muted-foreground opacity-50" />
        <span
          className={cn(
            'inline-flex shrink-0 text-foreground opacity-0',
            'animate-empty-demo-check',
            motionNoneClassName,
          )}
        >
          <Check className="size-3" strokeWidth={2.4} />
        </span>
      </span>
    </div>
  );
}
