'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

import DeleteCardDialog from '@/components/cards/DeleteCardDialog';
import EditCardDialog from '@/components/cards/EditCardDialog';
import { cn } from '@/lib/utils';

type SortableCardProps = {
  id: string;
  title: string;
  description: string | null;
};

export default function SortableCard({ id, title, description }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm',
        isDragging && 'opacity-50',
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
        </div>
        <div
          className="flex shrink-0 gap-2"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <EditCardDialog cardId={id} title={title} description={description} />
          <DeleteCardDialog cardId={id} title={title} />
        </div>
      </div>
    </li>
  );
}
