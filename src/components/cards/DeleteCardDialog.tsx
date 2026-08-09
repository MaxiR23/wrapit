'use client';

import { useState, useTransition } from 'react';

import { deleteCard } from '@/actions/deleteCard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';

type DeleteCardDialogProps = {
  cardId: string;
  title: string;
};

export default function DeleteCardDialog({ cardId, title }: DeleteCardDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCard({ cardId });
      if ('error' in result) {
        setError(GENERIC_ERROR_MESSAGE);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" aria-label={`Delete card ${title}`}>
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete card</DialogTitle>
          <DialogDescription>
            Delete &ldquo;{title}&rdquo;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            aria-label={`Confirm delete card ${title}`}
          >
            {isPending ? 'Deleting...' : 'Delete card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
