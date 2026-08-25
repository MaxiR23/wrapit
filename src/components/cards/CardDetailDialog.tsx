'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import CardDetailBody from '@/components/cards/CardDetailBody';
import type { BoardCardData, BoardMember } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { labelToneClasses } from '@/lib/labelTones';
import type { LabelView } from '@/lib/labels';
import { cn } from '@/lib/utils';

export default function CardDetailDialog({
  open,
  onOpenChange,
  card,
  columnId,
  columns,
  members,
  labels,
  currentUser,
  onCardPatch,
  onMoveColumn,
  onArchive,
  onDelete,
  onRestoreFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: BoardCardData | null;
  columnId: string;
  columns: Array<{ id: string; title: string }>;
  members: BoardMember[];
  labels: LabelView[];
  currentUser: BoardMember;
  onCardPatch: (patch: Partial<BoardCardData>) => void;
  onMoveColumn: (columnId: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onRestoreFocus?: () => void;
}) {
  const [askingDelete, setAskingDelete] = useState(false);
  const columnTitle = columns.find((column) => column.id === columnId)?.title ?? '';
  const tone = card?.label ? labelToneClasses(card.label.tone) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setAskingDelete(false);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-modal="true"
        overlayClassName="z-[80] bg-black/62"
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus?.();
        }}
        className={cn(
          'z-[80] flex flex-col gap-0 overflow-hidden border bg-surface p-0 text-foreground',
          'top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 shadow-none sm:max-w-none',
          'tablet:top-1/2 tablet:left-1/2 tablet:h-[calc(100dvh-5.5rem)] tablet:max-h-[calc(100dvh-5.5rem)] tablet:w-full tablet:max-w-[900px]',
          'tablet:-translate-x-1/2 tablet:-translate-y-1/2 tablet:rounded-[14px] tablet:border tablet:border-border-strong',
          'tablet:shadow-[0_30px_70px_oklch(0_0_0/0.6)] tablet:sm:max-w-[900px]',
        )}
      >
        {card ? (
          <>
            <div className="flex flex-none items-center gap-2.5 border-b border-border px-4 pt-0.5 pb-2.5 tablet:gap-2.5 tablet:px-5 tablet:py-4">
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className={cn(
                    shellFocusClassName,
                    '-ml-2 inline-flex size-[38px] shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground tablet:ml-0 tablet:size-[30px] tablet:rounded-sm tablet:hover:bg-card',
                  )}
                >
                  <X className="size-[18px] tablet:size-4" strokeWidth={1.8} />
                </button>
              </DialogClose>
              {card.label && tone ? (
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-[3px] text-[11.5px] font-medium',
                    tone.pill,
                  )}
                >
                  {card.label.name}
                </span>
              ) : null}
              <DialogTitle className="text-[12.5px] font-normal text-subtle tabular-nums tablet:text-xs">
                {card.code}
              </DialogTitle>
              <span className="text-[12.5px] text-subtle tablet:text-xs">·</span>
              <DialogDescription className="truncate text-[12.5px] text-muted-foreground tablet:text-xs">
                {columnTitle}
              </DialogDescription>
            </div>
            <CardDetailBody
              key={card.id}
              card={card}
              columnId={columnId}
              columns={columns}
              members={members}
              labels={labels}
              currentUser={currentUser}
              askingDelete={askingDelete}
              onAskingDelete={setAskingDelete}
              onCardPatch={onCardPatch}
              onMoveColumn={onMoveColumn}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
