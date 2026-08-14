'use client';

import { useState, useTransition } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { deleteColumn } from '@/actions/deleteColumn';
import SortableCard from '@/components/cards/SortableCard';
import CardsEmptyState from '@/components/cards/CardsEmptyState';
import NewCardDialog from '@/components/cards/NewCardDialog';
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
import { cn } from '@/lib/utils';

export type KanbanCardData = {
  id: string;
  title: string;
  description: string | null;
};

type KanbanColumnProps = {
  id: string;
  title: string;
  cardIds: string[];
  cardsById: Record<string, KanbanCardData>;
};

export default function KanbanColumn({ id, title, cardIds, cardsById }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <li
      data-column-id={id}
      className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30 p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <NewCardDialog columnId={id} columnTitle={title} />
          <DeleteColumnDialog columnId={id} title={title} />
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 rounded-md p-1',
          isOver && 'bg-muted/60',
        )}
      >
        <SortableContext id={id} items={cardIds} strategy={verticalListSortingStrategy}>
          {cardIds.length === 0 ? (
            <CardsEmptyState />
          ) : (
            <ul className="flex flex-col gap-2">
              {cardIds.map((cardId) => {
                const card = cardsById[cardId];
                if (!card) return null;
                return (
                  <SortableCard
                    key={card.id}
                    id={card.id}
                    title={card.title}
                    description={card.description}
                  />
                );
              })}
            </ul>
          )}
        </SortableContext>
      </div>
    </li>
  );
}

function DeleteColumnDialog({ columnId, title }: { columnId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteColumn({ columnId });
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
        <Button type="button" variant="outline" size="sm" aria-label={`Delete column ${title}`}>
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete column</DialogTitle>
          <DialogDescription>
            Delete &ldquo;{title}&rdquo;? This will also delete all cards in the column.
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
            aria-label={`Confirm delete column ${title}`}
          >
            {isPending ? 'Deleting...' : 'Delete column'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
