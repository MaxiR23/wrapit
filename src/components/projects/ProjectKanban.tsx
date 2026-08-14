'use client';

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import { moveCard } from '@/actions/moveCard';
import KanbanColumn, { type KanbanCardData } from '@/components/projects/KanbanColumn';
import {
  findContainer,
  transitionDragEnd,
  transitionDragOver,
  type ItemsByColumn,
  type MoveCommit,
} from '@/lib/kanbanItems';
import {
  applyPendingJobs,
  isMoveCardErrorResult,
  persistPayloadFromReconciled,
  reconcilePersistJob,
  reducePersistFinish,
} from '@/lib/kanbanPersist';

export type ProjectKanbanColumn = {
  id: string;
  title: string;
  cards: KanbanCardData[];
};

export type ProjectKanbanHandle = {
  /**
   * Applies an optimistic board update, persists via moveCard, and rolls back
   * on failure. Shared by drag-end and tests.
   */
  commitMove: (args: MoveCommit & { nextItems: ItemsByColumn }) => Promise<void>;
};

type ProjectKanbanProps = {
  columns: ProjectKanbanColumn[];
};

function buildInitialState(columns: ProjectKanbanColumn[]) {
  const itemsByColumn: ItemsByColumn = {};
  const cardsById: Record<string, KanbanCardData> = {};
  const columnTitles: Record<string, string> = {};

  for (const column of columns) {
    columnTitles[column.id] = column.title;
    itemsByColumn[column.id] = column.cards.map((card) => {
      cardsById[card.id] = card;
      return card.id;
    });
  }

  return { itemsByColumn, cardsById, columnTitles };
}

const MemoKanbanColumn = memo(KanbanColumn);

const ProjectKanban = forwardRef<ProjectKanbanHandle, ProjectKanbanProps>(function ProjectKanban(
  { columns },
  ref,
) {
  const [itemsByColumn, setItemsByColumn] = useState<ItemsByColumn>(
    () => buildInitialState(columns).itemsByColumn,
  );
  const [error, setError] = useState<string | null>(null);
  const cardsById = useRef(buildInitialState(columns).cardsById);
  const columnTitles = useRef(buildInitialState(columns).columnTitles);
  const itemsRef = useRef(itemsByColumn);
  itemsRef.current = itemsByColumn;
  const dragStartItemsRef = useRef<ItemsByColumn | null>(null);
  const persistedItemsRef = useRef(itemsByColumn);
  const persistChainRef = useRef(Promise.resolve());
  const persistQueueRef = useRef<MoveCommit[]>([]);

  useEffect(() => {
    // revalidatePath after a successful moveCard can refresh `columns` while
    // later moves are still queued — keep the queue and layer those jobs on
    // the new server baseline so in-flight commits are not dropped.
    const next = buildInitialState(columns);
    persistedItemsRef.current = next.itemsByColumn;
    setItemsByColumn(applyPendingJobs(next.itemsByColumn, persistQueueRef.current));
    cardsById.current = next.cardsById;
    columnTitles.current = next.columnTitles;
  }, [columns]);

  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const commitMove = useCallback(
    async ({
      cardId,
      targetColumnId,
      beforeCardId,
      afterCardId,
      nextItems,
    }: MoveCommit & { nextItems: ItemsByColumn }) => {
      const job: MoveCommit = { cardId, targetColumnId, beforeCardId, afterCardId };
      persistQueueRef.current = [...persistQueueRef.current, job];
      setError(null);
      setItemsByColumn(nextItems);

      const run = async () => {
        const finishedJob = persistQueueRef.current[0];
        if (!finishedJob) return;

        // Build the request from the baseline at enqueue time; re-read after
        // await so a columns refresh during the request is not overwritten.
        const requestBaseline = persistedItemsRef.current;
        const reconciled = reconcilePersistJob(requestBaseline, finishedJob);
        const payload = persistPayloadFromReconciled(reconciled, finishedJob);

        let failed = false;
        try {
          const result = await moveCard(payload);
          failed = isMoveCardErrorResult(result);
        } catch {
          failed = true;
        }

        persistQueueRef.current = persistQueueRef.current.slice(1);
        const latestBaseline = persistedItemsRef.current;
        const reduction = reducePersistFinish({
          persisted: latestBaseline,
          finishedJob,
          remainingJobs: persistQueueRef.current,
          failed,
        });

        persistedItemsRef.current = reduction.persisted;
        setItemsByColumn(reduction.display);
        setError(reduction.error);
      };

      const next = persistChainRef.current.then(run, run);
      persistChainRef.current = next.then(
        () => undefined,
        () => undefined,
      );
      await next;
    },
    [],
  );

  useImperativeHandle(ref, () => ({ commitMove }), [commitMove]);

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const startItems = dragStartItemsRef.current;
    if (!startItems) return;

    setItemsByColumn((items) =>
      transitionDragOver(items, startItems, String(active.id), String(over.id)),
    );
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const startItems = dragStartItemsRef.current;
    dragStartItemsRef.current = null;
    if (!startItems) return;

    const { items: nextItems, commit } = transitionDragEnd(
      startItems,
      itemsRef.current,
      String(active.id),
      over ? String(over.id) : null,
    );

    setItemsByColumn(nextItems);
    if (!commit) return;

    await commitMove({ ...commit, nextItems });
  }

  function onDragCancel() {
    if (dragStartItemsRef.current) {
      setItemsByColumn(dragStartItemsRef.current);
    }
    dragStartItemsRef.current = null;
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      const card = cardsById.current[String(active.id)];
      return `Picked up ${card?.title ?? 'card'}.`;
    },
    onDragOver({ active, over }) {
      const card = cardsById.current[String(active.id)];
      if (!over) {
        return `${card?.title ?? 'Card'} is no longer over a droppable area.`;
      }
      const overId = String(over.id);
      const overColumnId = findContainer(itemsRef.current, overId) ?? overId;
      const columnTitle = columnTitles.current[overColumnId] ?? 'a column';
      return `${card?.title ?? 'Card'} was moved over ${columnTitle}.`;
    },
    onDragEnd({ active, over }) {
      const card = cardsById.current[String(active.id)];
      if (!over) {
        return `${card?.title ?? 'Card'} was dropped.`;
      }
      const overId = String(over.id);
      const overColumnId = findContainer(itemsRef.current, overId) ?? overId;
      const columnTitle = columnTitles.current[overColumnId] ?? 'a column';
      return `${card?.title ?? 'Card'} was dropped in ${columnTitle}.`;
    },
    onDragCancel({ active }) {
      const card = cardsById.current[String(active.id)];
      return `Dragging was cancelled. ${card?.title ?? 'Card'} was dropped.`;
    },
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              'To pick up a card, press the space bar. While dragging, use the arrow keys to move the card between columns and positions. Press space again to drop the card, or press escape to cancel.',
          },
        }}
        onDragStart={() => {
          setError(null);
          dragStartItemsRef.current = itemsRef.current;
        }}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <ul className="flex gap-4 overflow-x-auto pb-2">
          {columnIds.map((columnId) => (
            <MemoKanbanColumn
              key={columnId}
              id={columnId}
              title={columnTitles.current[columnId] ?? ''}
              cardIds={itemsByColumn[columnId] ?? []}
              cardsById={cardsById.current}
            />
          ))}
        </ul>
      </DndContext>
    </div>
  );
});

export default ProjectKanban;
