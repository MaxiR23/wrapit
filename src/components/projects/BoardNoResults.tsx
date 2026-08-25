import { Button } from '@/components/ui/button';

export default function BoardNoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 pb-12 text-center tablet:px-7 tablet:pb-12">
      <p className="text-base font-semibold">No results</p>
      <p className="max-w-[340px] text-[13.5px] leading-normal text-muted-foreground text-pretty">
        No cards match the active filters.
      </p>
      <Button
        type="button"
        onClick={onClear}
        className="h-9 px-[15px] text-[13.5px] font-semibold tablet:h-9"
      >
        Clear search and filters
      </Button>
    </div>
  );
}
