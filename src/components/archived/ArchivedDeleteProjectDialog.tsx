'use client';

import { useState } from 'react';
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

export default function ArchivedDeleteProjectDialog({
  open,
  title,
  onCancel,
  onConfirm,
  pending = false,
}: {
  open: boolean;
  title: string | null;
  onCancel: () => void;
  onConfirm: (typedTitle: string) => void;
  pending?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const matches = title != null && typed === title;

  function close() {
    setTyped('');
    onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-[420px] gap-0 rounded-[10px] p-0 sm:max-w-[420px]"
      >
        <DialogHeader className="gap-3 px-5 pt-5">
          <div className="flex size-10 items-center justify-center rounded-md bg-danger-soft text-danger">
            <Trash2 className="size-5" strokeWidth={1.7} />
          </div>
          <DialogTitle className="text-[16px] font-semibold">
            {archivedCopy.projects.deleteTitle}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground text-pretty">
            {title ? archivedCopy.projects.deleteBody(title) : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pt-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-muted-foreground">
              {archivedCopy.projects.deleteConfirmHint}
            </span>
            <input
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={archivedCopy.projects.titlePlaceholder}
              autoComplete="off"
              className={cn(
                shellFocusClassName,
                'h-10 rounded-md border border-input bg-surface px-3 text-[13px]',
              )}
            />
          </label>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 border-t-0 bg-transparent p-5 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={close}
            className={cn(
              shellFocusClassName,
              'inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-[13px] font-medium tablet:h-[34px]',
            )}
          >
            {archivedCopy.cancel}
          </button>
          <button
            type="button"
            disabled={pending || !matches}
            onClick={() => {
              if (matches && title) onConfirm(typed);
            }}
            className={cn(
              shellFocusClassName,
              'inline-flex h-11 items-center justify-center rounded-md bg-danger px-4 text-[13px] font-medium text-primary-foreground tablet:h-[34px]',
              'tablet:order-last disabled:cursor-not-allowed disabled:opacity-50',
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
