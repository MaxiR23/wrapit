import { Archive } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ARCHIVED_FILTER_EMPTY, archivedEmptyCopy } from '@/lib/archived';
import { archivedCopy } from '@/lib/archivedCopy';
import { cn } from '@/lib/utils';

export default function ArchivedEmptyState({
  projectTitle,
  filtered,
  onClear,
}: {
  projectTitle: string;
  filtered: boolean;
  onClear: () => void;
}) {
  const copy = filtered ? ARCHIVED_FILTER_EMPTY : archivedEmptyCopy(projectTitle);
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-16 text-center">
      <Archive className="size-[26px] text-muted" strokeWidth={1.5} aria-hidden />
      <p className="text-[14px] font-medium text-foreground">{copy.title}</p>
      <p className="max-w-[340px] text-[12.5px] text-subtle text-pretty">{copy.body}</p>
      {filtered ? (
        <Button
          type="button"
          onClick={onClear}
          className={cn('mt-1 h-9 px-[15px] text-[13px] font-semibold')}
        >
          {archivedCopy.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
