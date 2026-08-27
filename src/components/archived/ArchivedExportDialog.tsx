'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ArchivedExportFormat } from '@/lib/archivedExport';
import { archivedCopy } from '@/lib/archivedCopy';
import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';

export default function ArchivedExportDialog({
  open,
  onCancel,
  onPick,
}: {
  open: boolean;
  onCancel: () => void;
  onPick: (format: ArchivedExportFormat) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent showCloseButton={false} className="max-w-[360px] gap-0 p-0 sm:max-w-[360px]">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-[16px] font-semibold">
            {archivedCopy.exportTitle}
          </DialogTitle>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 border-t-0 bg-transparent p-5 sm:flex-col">
          <button
            type="button"
            onClick={() => onPick('csv')}
            className={cn(
              shellFocusClassName,
              'inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-[13px] font-medium hover:bg-card-hover tablet:h-[34px]',
            )}
          >
            {archivedCopy.exportCsv}
          </button>
          <button
            type="button"
            onClick={() => onPick('json')}
            className={cn(
              shellFocusClassName,
              'inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-[13px] font-medium hover:bg-card-hover tablet:h-[34px]',
            )}
          >
            {archivedCopy.exportJson}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              shellFocusClassName,
              'inline-flex h-11 items-center justify-center rounded-md px-4 text-[13px] text-muted-foreground tablet:h-[34px]',
            )}
          >
            {archivedCopy.cancel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
