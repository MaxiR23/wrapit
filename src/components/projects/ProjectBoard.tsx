'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { moveCard } from '@/actions/moveCard';
import NewCardDialog, { type CreatedBoardCard } from '@/components/cards/NewCardDialog';
import BoardDesktop from '@/components/projects/BoardDesktop';
import BoardHeader from '@/components/projects/BoardHeader';
import BoardMobile from '@/components/projects/BoardMobile';
import type { BoardCardData, BoardColumnData, BoardMember } from '@/components/projects/boardTypes';
import { commitMoveToColumn, type ItemsByColumn } from '@/lib/kanbanItems';
import {
  applyPendingJobs,
  isMoveCardErrorResult,
  persistPayloadFromBaseline,
  reducePersistFinish,
} from '@/lib/kanbanPersist';
import { syncCardLabels, type LabelView } from '@/lib/labels';
import { projectProgress } from '@/lib/projectGrid';

export type ProjectBoardHandle = {
  commitMove: (cardId: string, targetColumnId: string) => Promise<void>;
};

type ProjectBoardProps = {
  title: string;
  projectId: string;
  columns: BoardColumnData[];
  members: BoardMember[];
  labels: LabelView[];
};

function buildInitialState(columns: BoardColumnData[]) {
  const itemsByColumn: ItemsByColumn = {};
  const cardsById: Record<string, BoardCardData> = {};
  const columnMeta: Array<{ id: string; title: string; order: number }> = [];

  for (const column of columns) {
    columnMeta.push({ id: column.id, title: column.title, order: column.order });
    itemsByColumn[column.id] = column.cards.map((card) => {
      cardsById[card.id] = card;
      return card.id;
    });
  }

  return { itemsByColumn, cardsById, columnMeta };
}

function columnsFromItems(
  columnMeta: Array<{ id: string; title: string; order: number }>,
  itemsByColumn: ItemsByColumn,
  cardsById: Record<string, BoardCardData>,
): BoardColumnData[] {
  return columnMeta.map((column) => ({
    ...column,
    cards: (itemsByColumn[column.id] ?? [])
      .map((id) => cardsById[id])
      .filter((card): card is BoardCardData => Boolean(card)),
  }));
}

const ProjectBoard = forwardRef<ProjectBoardHandle, ProjectBoardProps>(function ProjectBoard(
  { title, projectId, columns, members, labels: initialLabels },
  ref,
) {
  const initial = buildInitialState(columns);
  const [itemsByColumn, setItemsByColumn] = useState<ItemsByColumn>(initial.itemsByColumn);
  const [labels, setLabels] = useState(initialLabels);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [jumpToColumnId, setJumpToColumnId] = useState<string | null>(null);
  const [jumpToken, setJumpToken] = useState(0);
  const cardsById = useRef(initial.cardsById);
  const columnMeta = useRef(initial.columnMeta);
  const itemsRef = useRef(itemsByColumn);
  itemsRef.current = itemsByColumn;
  const persistedItemsRef = useRef(itemsByColumn);
  const persistChainRef = useRef(Promise.resolve());
  const persistQueueRef = useRef<Array<{ cardId: string; targetColumnId: string }>>([]);
  const createdCardsRef = useRef<Map<string, { card: BoardCardData; columnId: string }>>(new Map());
  const addTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [addColumnId, setAddColumnId] = useState<string | null>(null);

  useEffect(() => {
    const next = buildInitialState(columns);
    for (const [id, entry] of createdCardsRef.current) {
      if (next.cardsById[id]) {
        createdCardsRef.current.delete(id);
        continue;
      }
      next.cardsById[id] = entry.card;
      next.itemsByColumn[entry.columnId] = [...(next.itemsByColumn[entry.columnId] ?? []), id];
    }
    persistedItemsRef.current = next.itemsByColumn;
    const display = applyPendingJobs(next.itemsByColumn, persistQueueRef.current);
    itemsRef.current = display;
    setItemsByColumn(display);
    cardsById.current = next.cardsById;
    columnMeta.current = next.columnMeta;
  }, [columns]);

  useEffect(() => {
    setLabels(initialLabels);
    cardsById.current = syncCardLabels(cardsById.current, initialLabels);
  }, [initialLabels]);

  function handleLabelsChange(next: LabelView[]) {
    setLabels(next);
    cardsById.current = syncCardLabels(cardsById.current, next);
    setItemsByColumn((current) => ({ ...current }));
  }

  const displayColumns = columnsFromItems(columnMeta.current, itemsByColumn, cardsById.current);
  const progress = projectProgress(displayColumns);

  const commitMove = useCallback(async (cardId: string, targetColumnId: string) => {
    const { items: nextItems, commit } = commitMoveToColumn(
      itemsRef.current,
      cardId,
      targetColumnId,
    );
    if (!commit) return;

    persistQueueRef.current = [...persistQueueRef.current, commit];
    setError(null);
    itemsRef.current = nextItems;
    setItemsByColumn(nextItems);
    setJumpToColumnId(targetColumnId);
    setJumpToken((token) => token + 1);

    const run = async () => {
      const finishedJob = persistQueueRef.current[0];
      if (!finishedJob) return;

      const requestBaseline = persistedItemsRef.current;
      const payload = persistPayloadFromBaseline(requestBaseline, finishedJob);

      let failed = false;
      try {
        if (!payload) {
          failed = true;
        } else if (payload.sourceColumnId !== payload.targetColumnId) {
          const result = await moveCard(payload);
          failed = isMoveCardErrorResult(result);
        }
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
      itemsRef.current = reduction.display;
      setItemsByColumn(reduction.display);
      setError(reduction.error);
    };

    const next = persistChainRef.current.then(run, run);
    persistChainRef.current = next.then(
      () => undefined,
      () => undefined,
    );
    await next;
  }, []);

  useImperativeHandle(ref, () => ({ commitMove }), [commitMove]);

  function handleAddCard(columnId: string, trigger: HTMLButtonElement) {
    addTriggerRef.current = trigger;
    setAddColumnId(columnId);
  }

  function handleCardCreated(card: CreatedBoardCard) {
    const { columnId, ...boardCard } = card;
    createdCardsRef.current.set(boardCard.id, { card: boardCard, columnId });
    cardsById.current = { ...cardsById.current, [boardCard.id]: boardCard };
    setItemsByColumn((current) => {
      const next = {
        ...current,
        [columnId]: [...(current[columnId] ?? []), boardCard.id],
      };
      itemsRef.current = next;
      persistedItemsRef.current = {
        ...persistedItemsRef.current,
        [columnId]: persistedItemsRef.current[columnId]?.includes(boardCard.id)
          ? persistedItemsRef.current[columnId]
          : [...(persistedItemsRef.current[columnId] ?? []), boardCard.id],
      };
      return next;
    });
    setJumpToColumnId(columnId);
    setJumpToken((token) => token + 1);
  }

  function dropDraggingOn(columnId: string) {
    const cardId = draggingId;
    setDraggingId(null);
    setOverColumnId(null);
    if (!cardId) return;
    void commitMove(cardId, columnId);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BoardHeader
        title={title}
        doneCount={progress.doneCount}
        taskCount={progress.taskCount}
        percent={progress.percent}
        members={members}
      />

      {error ? (
        <p role="alert" className="px-4 text-sm text-destructive md:px-7">
          {error}
        </p>
      ) : null}

      <BoardDesktop
        columns={displayColumns}
        cardsById={cardsById.current}
        draggingId={draggingId}
        overColumnId={overColumnId}
        onDragStart={(cardId) => {
          setError(null);
          setDraggingId(cardId);
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setOverColumnId(null);
        }}
        onDragOverColumn={setOverColumnId}
        onDropOnColumn={dropDraggingOn}
        onMoveToColumn={(cardId, columnId) => {
          void commitMove(cardId, columnId);
        }}
        onAddCard={handleAddCard}
      />

      <BoardMobile
        columns={displayColumns}
        cardsById={cardsById.current}
        itemsByColumn={itemsByColumn}
        jumpToColumnId={jumpToColumnId}
        jumpToken={jumpToken}
        onMoveToColumn={(cardId, columnId) => {
          void commitMove(cardId, columnId);
        }}
        onAddCard={handleAddCard}
      />

      <NewCardDialog
        open={addColumnId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setAddColumnId(null);
        }}
        projectId={projectId}
        projectTitle={title}
        initialColumnId={addColumnId ?? columnMeta.current[0]?.id ?? ''}
        columns={columnMeta.current.map((column) => ({ id: column.id, title: column.title }))}
        members={members}
        labels={labels}
        onLabelsChange={handleLabelsChange}
        onCreated={handleCardCreated}
        onRestoreFocus={() => addTriggerRef.current?.focus()}
      />
    </div>
  );
});

ProjectBoard.displayName = 'ProjectBoard';

export default ProjectBoard;
