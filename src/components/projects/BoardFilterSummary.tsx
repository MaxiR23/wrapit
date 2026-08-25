import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

export default function BoardFilterSummary({
  summary,
  onClear,
}: {
  summary: string;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">{summary}</span>
      <button
        type="button"
        onClick={onClear}
        className={cn(
          shellFocusClassName,
          'ml-auto shrink-0 p-0 text-[12.5px] text-foreground underline decoration-solid underline-offset-[3px] tablet:ml-0',
        )}
      >
        Clear
      </button>
    </div>
  );
}
