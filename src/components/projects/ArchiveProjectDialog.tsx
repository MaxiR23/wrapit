'use client';

import { useState, useTransition } from 'react';

import { archiveProject } from '@/actions/archiveProject';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ARCHIVE_PROJECT_DESCRIPTION,
  ARCHIVE_PROJECT_LABEL,
  GENERIC_ERROR_MESSAGE,
} from '@/lib/messages';
import { archivedCopy } from '@/lib/archivedCopy';
import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';

export default function ArchiveProjectDialog({
  open,
  projectId,
  canAdminister,
  onOpenChange,
  onArchived,
}: {
  open: boolean;
  projectId: string | null;
  canAdminister: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const adminTitle = canAdminister ? undefined : archivedCopy.projects.adminOnly;

  function onConfirm() {
    if (!projectId || !canAdminister) return;
    setError(null);
    startTransition(async () => {
      const result = await archiveProject({ projectId });
      if ('error' in result) {
        setError(
          result.error === 'Unauthorized' ? archivedCopy.projects.adminOnly : GENERIC_ERROR_MESSAGE,
        );
        return;
      }
      onOpenChange(false);
      onArchived?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-[420px] gap-0 rounded-[10px] p-0 sm:max-w-[420px]"
      >
        <DialogHeader className="gap-3 px-5 pt-5">
          <DialogTitle className="text-[16px] font-semibold">{ARCHIVE_PROJECT_LABEL}</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground text-pretty">
            {ARCHIVE_PROJECT_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="px-5 pt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="flex-col-reverse gap-2 border-t-0 bg-transparent p-5 sm:flex-row">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            className={cn(
              shellFocusClassName,
              'inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-[13px] font-medium tablet:h-[34px]',
            )}
          >
            {archivedCopy.cancel}
          </button>
          <button
            type="button"
            disabled={isPending || !canAdminister}
            title={adminTitle}
            onClick={onConfirm}
            className={cn(
              shellFocusClassName,
              'inline-flex h-11 items-center justify-center rounded-md bg-danger px-4 text-[13px] font-medium text-primary-foreground tablet:h-[34px]',
              'tablet:order-last disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {isPending ? 'Archiving...' : ARCHIVE_PROJECT_LABEL}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
