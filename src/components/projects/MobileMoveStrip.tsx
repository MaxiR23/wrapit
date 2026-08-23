import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';

export default function MobileMoveStrip({
  code,
  columns,
  currentColumnId,
  overColumnId,
  onPick,
}: {
  code: string;
  columns: Array<{ id: string; title: string }>;
  currentColumnId: string;
  overColumnId: string | null;
  onPick: (columnId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-border-strong bg-surface px-4 pt-3.5 pb-[26px] shadow-[0_-18px_44px_oklch(0_0_0/0.55)]">
      <span className="text-[12.5px] text-muted-foreground">Move {code} to</span>
      <div className="grid grid-cols-2 gap-2">
        {columns.map((column) => {
          const over = overColumnId === column.id;
          const same = column.id === currentColumnId;
          return (
            <button
              key={column.id}
              type="button"
              data-drop={column.id}
              onClick={() => onPick(column.id)}
              className={cn(
                shellFocusClassName,
                'h-[46px] rounded-md border text-[13.5px] font-medium',
                over
                  ? 'border-foreground bg-foreground text-primary-foreground'
                  : same
                    ? 'border-border-strong bg-transparent text-subtle'
                    : 'border-border-strong bg-transparent text-foreground',
              )}
            >
              {column.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
