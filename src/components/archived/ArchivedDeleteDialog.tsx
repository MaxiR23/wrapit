'use client';

import { Trash2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { archivedCopy } from '@/lib/archivedCopy';
import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';

export default function ArchivedDeleteDialog({
  open,
  names,
  onCancel,
  onConfirm,
  pending = false,
}: {
  open: boolean;
  names: string[];
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const count = names.length;
  const title = count === 1 ? archivedCopy.deleteTitleOne : archivedCopy.deleteTitleMany(count);
  const body =
    count === 1 && names[0]
      ? archivedCopy.deleteBody(names[0])
      : archivedCopy.deleteBodyMany(count);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-[420px] gap-0 rounded-[10px] p-0 sm:max-w-[420px]"
      >
        <DialogHeader className="gap-3 px-5 pt-5">
          <div className="flex size-10 items-center justify-center rounded-md bg-danger-soft text-danger">
            <Trash2 className="size-5" strokeWidth={1.7} />
          </div>
          <DialogTitle className="text-[16px] font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground text-pretty">
            {body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 border-t-0 bg-transparent p-5 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className={cn(
              shellFocusClassName,
              'inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-[13px] font-medium tablet:h-[34px]',
            )}
          >
            {archivedCopy.cancel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={cn(
              shellFocusClassName,
              'inline-flex h-11 items-center justify-center rounded-md bg-danger px-4 text-[13px] font-medium text-primary-foreground tablet:h-[34px]',
              'tablet:order-last',
            )}
          >
            <span className="tablet:hidden">{archivedCopy.deleteConfirmPhone}</span>
            <span className="hidden tablet:inline">{archivedCopy.deleteConfirm}</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
