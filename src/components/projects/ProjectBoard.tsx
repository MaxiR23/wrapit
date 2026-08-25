'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { archiveCard } from '@/actions/archiveCard';
import { deleteCard } from '@/actions/deleteCard';
import { listActivityEvents } from '@/actions/listActivityEvents';
import { moveCard } from '@/actions/moveCard';
import { updateBoardVisibility } from '@/actions/updateBoardVisibility';
import CardDetailDialog from '@/components/cards/CardDetailDialog';
import NewCardDialog, { type CreatedBoardCard } from '@/components/cards/NewCardDialog';
import BoardActivityLog from '@/components/projects/BoardActivityLog';
import BoardDesktop from '@/components/projects/BoardDesktop';
import BoardHeader from '@/components/projects/BoardHeader';
import BoardMobile from '@/components/projects/BoardMobile';
import BoardNoResults from '@/components/projects/BoardNoResults';
import BoardToast, { type BoardToastMessage } from '@/components/projects/BoardToast';
import ColumnsEmptyState from '@/components/projects/ColumnsEmptyState';
import ShareModal from '@/components/projects/ShareModal';
import { ViewerTimeZoneProvider } from '@/components/projects/ViewerTimeZoneProvider';
import type {
  BoardCardData,
  BoardColumnData,
  BoardMember,
  ShareMember,
} from '@/components/projects/boardTypes';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import {
  boardHasNoResults,
  DEFAULT_BOARD_VISIBILITY,
  emptyBoardFilters,
  filterBoardCards,
  pruneBoardFilterLabelIds,
  type BoardFilters,
  type BoardVisibility,
} from '@/lib/boardView';
import { commitMoveToColumn, findContainer, type ItemsByColumn } from '@/lib/kanbanItems';
import {
  applyPendingJobs,
  isMoveCardErrorResult,
  persistPayloadFromBaseline,
  reducePersistFinish,
} from '@/lib/kanbanPersist';
import { syncCardLabels, type LabelView } from '@/lib/labels';
import {
  canAdministerProject,
  canCommentOnBoard,
  canEditBoard,
  type MembershipRole,
} from '@/lib/boardAccess';
import type { BoardAccess } from '@/lib/membership';
import type { ActivityCursor, ActivityEventListItem } from '@/lib/activity';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { projectProgress } from '@/lib/projectGrid';

export type ProjectBoardHandle = {
  commitMove: (cardId: string, targetColumnId: string) => Promise<void>;
};

type ProjectBoardProps = {
  title: string;
  projectId: string;
  columns: BoardColumnData[];
  members: BoardMember[];
  shareMembers?: ShareMember[];
  labels: LabelView[];
  currentUser: BoardMember;
  initialVisibility?: BoardVisibility;
  boardAccess?: BoardAccess;
  teamRole?: MembershipRole;
  publicLinkEnabled?: boolean;
};

const EMPTY_SHARE_MEMBERS: ShareMember[] = [];

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
  {
    title,
    projectId,
    columns,
    members,
    shareMembers: initialShareMembers = EMPTY_SHARE_MEMBERS,
    labels: initialLabels,
    currentUser,
    initialVisibility = DEFAULT_BOARD_VISIBILITY,
    boardAccess = 'EDIT',
    teamRole = 'OWNER',
    publicLinkEnabled: initialPublicLinkEnabled = false,
  },
  ref,
) {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const { query, setQuery } = useProjectsSearch();
  const initial = buildInitialState(columns);
  const [itemsByColumn, setItemsByColumn] = useState<ItemsByColumn>(initial.itemsByColumn);
  const [labels, setLabels] = useState(initialLabels);
  const [shareMembers, setShareMembers] = useState(initialShareMembers);
  const [publicLinkEnabled, setPublicLinkEnabled] = useState(initialPublicLinkEnabled);
  const [filters, setFilters] = useState<BoardFilters>(emptyBoardFilters);
  const [visibility, setVisibility] = useState<BoardVisibility>(initialVisibility);
  const latestVisibilityRef = useRef(initialVisibility);
  const persistedVisibilityRef = useRef(initialVisibility);
  const persistVisibilityInFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [jumpToColumnId, setJumpToColumnId] = useState<string | null>(null);
  const [jumpToken, setJumpToken] = useState(0);
  const [surface, setSurface] = useState<'board' | 'log'>('board');
  const [activityItems, setActivityItems] = useState<ActivityEventListItem[]>([]);
  const [activityCursor, setActivityCursor] = useState<ActivityCursor | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const activityRequestIdRef = useRef(0);
  const cardsById = useRef(initial.cardsById);
  const columnMeta = useRef(initial.columnMeta);
  const itemsRef = useRef(itemsByColumn);
  itemsRef.current = itemsByColumn;
  const persistedItemsRef = useRef(itemsByColumn);
  const persistChainRef = useRef(Promise.resolve());
  const persistQueueRef = useRef<Array<{ cardId: string; targetColumnId: string }>>([]);
  const createdCardsRef = useRef<Map<string, { card: BoardCardData; columnId: string }>>(new Map());
  const addTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openTriggerRef = useRef<HTMLElement | null>(null);
  const pendingCardWritesRef = useRef<Map<string, BoardCardData>>(new Map());
  const [addColumnId, setAddColumnId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [toast, setToast] = useState<BoardToastMessage | null>(null);

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
    for (const [id, local] of pendingCardWritesRef.current) {
      if (next.cardsById[id]) {
        next.cardsById[id] = local;
      } else {
        pendingCardWritesRef.current.delete(id);
      }
    }
    persistedItemsRef.current = next.itemsByColumn;
    const display = applyPendingJobs(next.itemsByColumn, persistQueueRef.current);
    itemsRef.current = display;
    setItemsByColumn(display);
    cardsById.current = next.cardsById;
    columnMeta.current = next.columnMeta;
  }, [columns]);

  useEffect(() => {
    setShareMembers(initialShareMembers);
  }, [initialShareMembers]);

  useEffect(() => {
    setPublicLinkEnabled(initialPublicLinkEnabled);
  }, [initialPublicLinkEnabled]);

  useEffect(() => {
    setLabels(initialLabels);
    cardsById.current = syncCardLabels(cardsById.current, initialLabels);
    setFilters((current) => pruneBoardFilterLabelIds(current, initialLabels));
  }, [initialLabels]);

  useEffect(() => {
    setVisibility(initialVisibility);
    latestVisibilityRef.current = initialVisibility;
    persistedVisibilityRef.current = initialVisibility;
  }, [initialVisibility]);

  useEffect(() => {
    if (addColumnId !== null || openCardId !== null) setOpenPanel(null);
  }, [addColumnId, openCardId, setOpenPanel]);

  function handleLabelsChange(next: LabelView[]) {
    setLabels(next);
    cardsById.current = syncCardLabels(cardsById.current, next);
    setFilters((current) => pruneBoardFilterLabelIds(current, next));
    setItemsByColumn((current) => ({ ...current }));
  }

  async function persistLatestVisibility() {
    if (persistVisibilityInFlightRef.current) return;
    persistVisibilityInFlightRef.current = true;
    try {
      let intended: BoardVisibility;
      do {
        intended = latestVisibilityRef.current;
        const result = await updateBoardVisibility(intended);
        if (!('data' in result)) {
          throw new Error(GENERIC_ERROR_MESSAGE);
        }
        persistedVisibilityRef.current = intended;
      } while (latestVisibilityRef.current !== intended);
    } catch {
      const persisted = persistedVisibilityRef.current;
      latestVisibilityRef.current = persisted;
      setVisibility(persisted);
      setError(GENERIC_ERROR_MESSAGE);
    } finally {
      persistVisibilityInFlightRef.current = false;
    }
  }

  function handleVisibilityChange(next: BoardVisibility) {
    setError(null);
    setVisibility(next);
    latestVisibilityRef.current = next;
    void persistLatestVisibility();
  }

  const allColumns = columnsFromItems(columnMeta.current, itemsByColumn, cardsById.current);
  const progress = projectProgress(allColumns);
  const visibleCards = filterBoardCards({
    cards: Object.values(cardsById.current),
    filters,
    query,
    currentUserId: currentUser.id,
  });
  const visibleIds = new Set(visibleCards.map((card) => card.id));
  const displayColumns = allColumns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => visibleIds.has(card.id)),
  }));
  const noResults = boardHasNoResults({
    totalCount: progress.taskCount,
    visibleCount: visibleCards.length,
  });
  const canEdit = canEditBoard(boardAccess);
  const canComment = canCommentOnBoard(boardAccess);
  const canAdminister = canAdministerProject(teamRole);

  const commitMove = useCallback(
    async (cardId: string, targetColumnId: string) => {
      if (!canEdit) return;
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
    },
    [canEdit],
  );

  useImperativeHandle(ref, () => ({ commitMove }), [commitMove]);

  function handleAddCard(columnId: string, trigger: HTMLButtonElement) {
    if (!canEdit) return;
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

  function bumpBoard() {
    setItemsByColumn((current) => ({ ...current }));
  }

  function handleOpenCard(cardId: string, trigger: HTMLElement) {
    openTriggerRef.current = trigger;
    setOpenCardId(cardId);
  }

  function patchOpenCard(patch: Partial<BoardCardData>) {
    if (!openCardId) return;
    const current = cardsById.current[openCardId];
    if (!current) return;
    const next = { ...current, ...patch };
    cardsById.current = { ...cardsById.current, [openCardId]: next };
    pendingCardWritesRef.current.set(openCardId, next);
    bumpBoard();
  }

  function removeCardFromBoard(cardId: string) {
    pendingCardWritesRef.current.delete(cardId);
    createdCardsRef.current.delete(cardId);
    const nextCards = { ...cardsById.current };
    delete nextCards[cardId];
    cardsById.current = nextCards;
    setItemsByColumn((current) => {
      const next: ItemsByColumn = {};
      for (const [columnId, ids] of Object.entries(current)) {
        next[columnId] = ids.filter((id) => id !== cardId);
      }
      itemsRef.current = next;
      const persisted: ItemsByColumn = {};
      for (const [columnId, ids] of Object.entries(persistedItemsRef.current)) {
        persisted[columnId] = ids.filter((id) => id !== cardId);
      }
      persistedItemsRef.current = persisted;
      return next;
    });
  }

  async function handleArchive() {
    if (!openCardId) return;
    const cardId = openCardId;
    const result = await archiveCard({ cardId });
    if ('error' in result) {
      setError(GENERIC_ERROR_MESSAGE);
      return;
    }
    setOpenCardId(null);
    removeCardFromBoard(cardId);
    setToast({ message: 'Task archived', role: 'status' });
  }

  async function handleDelete() {
    if (!openCardId) return;
    const cardId = openCardId;
    const result = await deleteCard({ cardId });
    if ('error' in result) {
      setError(GENERIC_ERROR_MESSAGE);
      return;
    }
    setOpenCardId(null);
    removeCardFromBoard(cardId);
    setToast({ message: 'Task deleted', role: 'alert' });
  }

  function dropDraggingOn(columnId: string) {
    const cardId = draggingId;
    setDraggingId(null);
    setOverColumnId(null);
    if (!cardId) return;
    void commitMove(cardId, columnId);
  }

  async function loadActivity(cursor?: ActivityCursor) {
    const requestId = activityRequestIdRef.current + 1;
    activityRequestIdRef.current = requestId;
    setActivityLoading(true);
    try {
      const result = await listActivityEvents({ projectId, cursor });
      if (requestId !== activityRequestIdRef.current) return;
      if ('error' in result) {
        setActivityError(GENERIC_ERROR_MESSAGE);
        return;
      }
      setActivityError(null);
      setActivityItems((current) =>
        cursor ? [...current, ...result.data.items] : result.data.items,
      );
      setActivityCursor(result.data.nextCursor);
    } catch {
      if (requestId !== activityRequestIdRef.current) return;
      setActivityError(GENERIC_ERROR_MESSAGE);
    } finally {
      if (requestId === activityRequestIdRef.current) {
        setActivityLoading(false);
      }
    }
  }

  function handleToggleLog() {
    setOpenPanel(null);
    if (surface === 'log') {
      setSurface('board');
      return;
    }
    setSurface('log');
    setActivityItems([]);
    setActivityCursor(null);
    setActivityError(null);
    void loadActivity();
  }

  return (
    <ViewerTimeZoneProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <BoardHeader
          title={title}
          doneCount={progress.doneCount}
          taskCount={progress.taskCount}
          percent={progress.percent}
          members={members}
          labels={labels}
          filters={filters}
          onFiltersChange={setFilters}
          visibility={visibility}
          onVisibilityChange={handleVisibilityChange}
          visibleCount={visibleCards.length}
          logOpen={surface === 'log'}
          onToggleLog={handleToggleLog}
        />

        {error ? (
          <p role="alert" className="px-4 text-sm text-destructive md:px-7">
            {error}
          </p>
        ) : null}

        {surface === 'log' ? (
          <BoardActivityLog
            items={activityItems}
            loading={activityLoading}
            error={activityError}
            hasMore={activityCursor !== null}
            onLoadMore={() => {
              if (activityCursor) void loadActivity(activityCursor);
            }}
          />
        ) : null}

        <div className={surface === 'log' ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
          {displayColumns.length === 0 ? (
            <div className="flex-1 px-4 py-6 tablet:px-[18px] lg:px-7">
              <ColumnsEmptyState />
            </div>
          ) : noResults ? (
            <BoardNoResults
              onClear={() => {
                setFilters(emptyBoardFilters());
                setQuery('');
              }}
            />
          ) : (
            <>
              <BoardDesktop
                columns={displayColumns}
                cardsById={cardsById.current}
                draggingId={draggingId}
                overColumnId={overColumnId}
                visibility={visibility}
                canEdit={canEdit}
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
                onAddCard={canEdit ? handleAddCard : undefined}
                onOpenCard={handleOpenCard}
              />

              <BoardMobile
                columns={displayColumns}
                cardsById={cardsById.current}
                itemsByColumn={itemsByColumn}
                jumpToColumnId={jumpToColumnId}
                jumpToken={jumpToken}
                visibility={visibility}
                canEdit={canEdit}
                onMoveToColumn={(cardId, columnId) => {
                  void commitMove(cardId, columnId);
                }}
                onAddCard={canEdit ? handleAddCard : undefined}
                onOpenCard={handleOpenCard}
              />
            </>
          )}
        </div>

        <NewCardDialog
          open={canEdit && addColumnId !== null}
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

        <CardDetailDialog
          open={openCardId !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setOpenCardId(null);
          }}
          card={openCardId ? (cardsById.current[openCardId] ?? null) : null}
          columnId={openCardId ? (findContainer(itemsByColumn, openCardId) ?? '') : ''}
          columns={columnMeta.current.map((column) => ({ id: column.id, title: column.title }))}
          members={members}
          labels={labels}
          currentUser={currentUser}
          canEdit={canEdit}
          canComment={canComment}
          onCardPatch={patchOpenCard}
          onMoveColumn={(columnId) => {
            if (!openCardId) return;
            void commitMove(openCardId, columnId);
          }}
          onArchive={() => void handleArchive()}
          onDelete={() => void handleDelete()}
          onRestoreFocus={() => openTriggerRef.current?.focus()}
        />

        <ShareModal
          open={openPanel === 'share'}
          onOpenChange={(nextOpen) => setOpenPanel(nextOpen ? 'share' : null)}
          projectId={projectId}
          projectTitle={title}
          members={shareMembers}
          canAdminister={canAdminister}
          publicLinkEnabled={publicLinkEnabled}
          onAccessChange={(membershipId, access) => {
            setShareMembers((current) =>
              current.map((member) =>
                member.membershipId === membershipId ? { ...member, access } : member,
              ),
            );
          }}
          onRemoved={(membershipId) => {
            setShareMembers((current) =>
              current.filter((member) => member.membershipId !== membershipId),
            );
          }}
          onPublicLinkChange={setPublicLinkEnabled}
        />

        <BoardToast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </ViewerTimeZoneProvider>
  );
});

ProjectBoard.displayName = 'ProjectBoard';

export default ProjectBoard;
