import { cn } from '@/lib/utils';

export default function ProjectsBrand({
  compact = false,
  showName = true,
}: {
  compact?: boolean;
  showName?: boolean;
}) {
  return (
    <div className={cn('flex items-center', compact ? 'justify-center' : 'gap-2.5 px-1.5')}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg bg-foreground font-semibold text-primary-foreground',
          compact ? 'size-[30px] rounded-[9px] text-sm' : 'size-[26px] text-[13px]',
        )}
      >
        w
      </span>
      {showName ? (
        <span className="text-[15px] font-semibold tracking-[-0.01em]">wrapit</span>
      ) : null}
    </div>
  );
}
