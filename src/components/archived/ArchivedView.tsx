'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, Clock, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { getArchivedCardDetail } from '@/actions/getArchivedCardDetail';
import { getArchivedCardsDetail } from '@/actions/getArchivedCardsDetail';
import { getArchivedProjectDetail } from '@/actions/getArchivedProjectDetail';
import { countArchivedCards } from '@/actions/countArchivedCards';
import { countArchivedProjects } from '@/actions/countArchivedProjects';
import { listArchivedCards } from '@/actions/listArchivedCards';
import { listArchivedProjects } from '@/actions/listArchivedProjects';
import { deleteArchivedCards } from '@/actions/deleteArchivedCards';
import { deleteArchivedProject } from '@/actions/deleteArchivedProject';
import { rearchiveArchivedCards } from '@/actions/rearchiveArchivedCards';
import { rearchiveArchivedProjects } from '@/actions/rearchiveArchivedProjects';
import { restoreArchivedCards } from '@/actions/restoreArchivedCards';
import { restoreArchivedProjects } from '@/actions/restoreArchivedProjects';
import ScreenHeader from '@/components/ScreenHeader';
import { searchFieldDomProps } from '@/components/mobileChrome';
import ArchivedDeleteDialog from '@/components/archived/ArchivedDeleteDialog';
import ArchivedDeleteProjectDialog from '@/components/archived/ArchivedDeleteProjectDialog';
import ArchivedDetail from '@/components/archived/ArchivedDetail';
import ArchivedEmptyState from '@/components/archived/ArchivedEmptyState';
import ArchivedExportDialog from '@/components/archived/ArchivedExportDialog';
import ArchivedRow from '@/components/archived/ArchivedRow';
import LoadMore from '@/components/pagination/LoadMore';
import BoardToast, { type BoardToastMessage } from '@/components/projects/BoardToast';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  ARCHIVED_DEFAULT_LIST_FILTER,
  ARCHIVED_PAGE_SIZE,
  ARCHIVED_PROJECTS_EMPTY,
  applyArchivedCardDetail,
  archivedCountLabel,
  archivedListFilter,
  archivedListFiltersEqual,
  archivedListIsDefault,
  archivedPhoneSelectedLabel,
  archivedProjectCountLabel,
  archivedProjectSelectedLabel,
  archivedSelectedLabel,
  filterArchivedProjects,
  filterArchivedTasks,
  insertArchivedProjects,
  insertArchivedTasks,
  reviveArchivedProject,
  reviveArchivedTask,
  sliceArchivedTasks,
  type ArchivedDateRange,
  type ArchivedListFilter,
  type ArchivedProject,
  type ArchivedSort,
  type ArchivedTask,
} from '@/lib/archived';
import { archivedCopy } from '@/lib/archivedCopy';
import { MAX_ARCHIVED_BATCH } from '@/lib/validation/archived';
import {
  cappedExcludeIds,
  confirm,
  countWriterIsAmbiguous,
  emptyPendingHidden,
  excludeSetKey,
  hide,
  hiddenIds,
  isTooNarrow,
  releaseAfterFirstPage,
  shownCount,
  unhide,
  type CountKind,
  type PendingHiddenState,
} from '@/lib/pendingHidden';
import {
  archivedExportFilename,
  archivedTasksCsv,
  archivedTasksJson,
  loadArchivedExportDetails,
  type ArchivedExportFormat,
} from '@/lib/archivedExport';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { PROJECTS_PATH, projectPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

const RANGES: ArchivedDateRange[] = ['all', '7', '30', 'old'];

function hasArchivedProjects(data: {
  projects?: unknown;
  cards?: unknown;
  totalCount: number;
  hasMore?: unknown;
  nextCursor?: unknown;
}): data is {
  projects: ArchivedProject[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
} {
  return (
    Array.isArray(data.projects) &&
    typeof data.hasMore === 'boolean' &&
    (data.nextCursor === null || typeof data.nextCursor === 'string')
  );
}

function hasArchivedCards(data: {
  projects?: unknown;
  cards?: unknown;
  totalCount: number;
  hasMore?: unknown;
  nextCursor?: unknown;
}): data is {
  cards: ArchivedTask[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
} {
  return (
    Array.isArray(data.cards) &&
    typeof data.hasMore === 'boolean' &&
    (data.nextCursor === null || typeof data.nextCursor === 'string')
  );
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ArchivedView({
  projectId,
  projectTitle,
  initialCards = [],
  initialProjects,
  initialTotalCount,
  initialHasMore = false,
  initialNextCursor = null,
  canAdminister = false,
}: {
  projectId?: string;
  projectTitle?: string;
  initialCards?: ArchivedTask[];
  initialProjects?: ArchivedProject[];
  initialTotalCount?: number;
  initialHasMore?: boolean;
  initialNextCursor?: string | null;
  canAdminister?: boolean;
}) {
  const isProjects = initialProjects != null;
  const paged = initialTotalCount != null;
  const router = useRouter();
  const { query, setQuery } = useProjectsSearch();
  const [cards, setCards] = useState(() => initialCards.map(reviveArchivedTask));
  const [projects, setProjects] = useState(() =>
    (initialProjects ?? []).map(reviveArchivedProject),
  );
  const [range, setRange] = useState<ArchivedDateRange>('all');
  const [sort, setSort] = useState<ArchivedSort>('date');
  const [limit, setLimit] = useState(ARCHIVED_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(initialTotalCount ?? 0);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [listFilter, setListFilter] = useState<ArchivedListFilter>(ARCHIVED_DEFAULT_LIST_FILTER);
  const [listError, setListError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; dx: number; tween: boolean } | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [exportIds, setExportIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState<BoardToastMessage | null>(null);
  const [now] = useState(() => new Date());
  const cardGenRef = useRef(new Map<string, number>());
  const opCounterRef = useRef(0);
  const skipNextListFetch = useRef(archivedListIsDefault(query, range, sort));
  const listEpochRef = useRef(0);
  const requestSeqRef = useRef(0);
  const lastTotalCountSeqRef = useRef(0);
  const countInFlightKeysRef = useRef(new Set<string>());
  const forcedCountRetryKeysRef = useRef(new Set<string>());
  const startCountOnlyRef = useRef<() => void>(() => {});
  const cardsRef = useRef(cards);
  const projectsRef = useRef(projects);
  const [pendingHidden, setPendingHidden] = useState(emptyPendingHidden);
  const [lastPageIds, setLastPageIds] = useState(
    () => new Set((initialProjects ?? initialCards).map((item) => item.id)),
  );
  const [exactExcludeIds, setExactExcludeIds] = useState(() => new Set<string>());
  const [countKind, setCountKind] = useState<CountKind>('list');
  const [listGeneration, setListGeneration] = useState(0);
  const [queryEpoch, setQueryEpoch] = useState(query);
  if (query !== queryEpoch) {
    setQueryEpoch(query);
    setLimit(ARCHIVED_PAGE_SIZE);
    setSelectedIds([]);
    setSelectionMode(false);
    setOpenId(null);
    setSwipe(null);
  }

  const currentFilter = archivedListFilter(query, range, sort);
  const currentFilterRef = useRef(currentFilter);
  const pendingHiddenRef = useRef(pendingHidden);
  const lastPageIdsRef = useRef(lastPageIds);
  const exactExcludeIdsRef = useRef(exactExcludeIds);
  const countKindRef = useRef(countKind);
  useLayoutEffect(() => {
    currentFilterRef.current = currentFilter;
    cardsRef.current = cards;
    projectsRef.current = projects;
  });
  const listPending = paged && !archivedListFiltersEqual(listFilter, currentFilter);
  const rowLive = !listPending;
  const hiddenIdSet = pendingHidden.byId;
  const displayCount = shownCount({
    totalCount,
    lastPageIds,
    hiddenIds: hiddenIds(pendingHidden),
    exactExcludeIds,
    countKind,
  });

  const filteredCards = useMemo(
    () => (paged ? cards : filterArchivedTasks(cards, { query, range, sort, now })),
    [paged, cards, query, range, sort, now],
  );
  const filteredProjects = useMemo(
    () => (paged ? projects : filterArchivedProjects(projects, { query, range, sort, now })),
    [paged, projects, query, range, sort, now],
  );
  const { shown, remaining } = paged
    ? {
        shown: (isProjects ? filteredProjects : filteredCards).filter(
          (item) => !hiddenIdSet.has(item.id),
        ),
        remaining: 0,
      }
    : isProjects
      ? sliceArchivedTasks(filteredProjects, limit)
      : sliceArchivedTasks(filteredCards, limit);
  const selectedShown = shown.filter((item) => selectedIds.includes(item.id));
  const allShownSelected = shown.length > 0 && selectedShown.length === shown.length;
  const filtersOn = query.trim() !== '' || range !== 'all';
  const openCard =
    !isProjects && openId ? (cards.find((card) => card.id === openId) ?? null) : null;
  const openProject =
    isProjects && openId ? (projects.find((project) => project.id === openId) ?? null) : null;

  function currentCappedHidden(state: PendingHiddenState = pendingHiddenRef.current) {
    return cappedExcludeIds(hiddenIds(state), MAX_ARCHIVED_BATCH);
  }

  function startCountOnly(state: PendingHiddenState = pendingHiddenRef.current, force = false) {
    if (!paged) return;
    const excludeIds = currentCappedHidden(state);
    const needsRefresh =
      force ||
      countWriterIsAmbiguous({
        cappedHiddenIds: excludeIds,
        exactExcludeIds: exactExcludeIdsRef.current,
        kind: countKindRef.current,
        lastPageIds: lastPageIdsRef.current,
      }) ||
      isTooNarrow(exactExcludeIdsRef.current, state.staleExcludes);
    if (!needsRefresh) return;
    const key = excludeSetKey(excludeIds);
    if (countInFlightKeysRef.current.has(key)) {
      if (force) forcedCountRetryKeysRef.current.add(key);
      return;
    }
    countInFlightKeysRef.current.add(key);
    const seq = ++requestSeqRef.current;
    const epoch = listEpochRef.current;
    const requested = currentFilterRef.current;
    function finishRequest() {
      countInFlightKeysRef.current.delete(key);
      const retryForced = forcedCountRetryKeysRef.current.delete(key);
      return retryForced;
    }
    function requestIsCurrent() {
      return (
        epoch === listEpochRef.current &&
        archivedListFiltersEqual(requested, currentFilterRef.current)
      );
    }
    function reconcileAfterRequest(retryForced: boolean) {
      if (retryForced) startCountOnly(pendingHiddenRef.current, true);
      else startCountOnly(pendingHiddenRef.current);
    }
    void (
      isProjects
        ? countArchivedProjects({
            query: requested.query,
            range: requested.range,
            excludeIds,
          })
        : projectId
          ? countArchivedCards({
              projectId,
              query: requested.query,
              range: requested.range,
              excludeIds,
            })
          : Promise.resolve({ error: 'Unauthorized' as const })
    )
      .then((result) => {
        const retryForced = finishRequest();
        if (!requestIsCurrent()) {
          if (retryForced) reconcileAfterRequest(true);
          return;
        }
        if ('error' in result) {
          setListGeneration((current) => current + 1);
          return;
        }
        if (isTooNarrow(result.data.excludeIds, pendingHiddenRef.current.staleExcludes)) {
          reconcileAfterRequest(retryForced);
          return;
        }
        if (seq > lastTotalCountSeqRef.current) {
          lastTotalCountSeqRef.current = seq;
          setTotalCount(result.data.totalCount);
          const exact = new Set(result.data.excludeIds);
          setExactExcludeIds(exact);
          exactExcludeIdsRef.current = exact;
          setCountKind('count');
          countKindRef.current = 'count';
        }
        reconcileAfterRequest(retryForced);
      })
      .catch(() => {
        const retryForced = finishRequest();
        if (!requestIsCurrent()) {
          if (retryForced) reconcileAfterRequest(true);
          return;
        }
        setListGeneration((current) => current + 1);
      });
  }
  startCountOnlyRef.current = () => startCountOnly();

  function adoptListCount(
    seq: number,
    total: number,
    itemIds: string[],
    nextHasMore: boolean,
    cursor: string | null,
    sentExclude: string[],
  ) {
    setHasMore(nextHasMore);
    setNextCursor(cursor);
    if (seq <= lastTotalCountSeqRef.current) return;
    lastTotalCountSeqRef.current = seq;
    setTotalCount(total);
    const pageIds = new Set(itemIds);
    setLastPageIds(pageIds);
    lastPageIdsRef.current = pageIds;
    const exact = new Set(sentExclude);
    setExactExcludeIds(exact);
    exactExcludeIdsRef.current = exact;
    setCountKind('list');
    countKindRef.current = 'list';
  }

  useEffect(() => {
    if (!paged) return;
    if (skipNextListFetch.current) {
      skipNextListFetch.current = false;
      return;
    }
    const requested = archivedListFilter(query, range, sort);
    const epoch = ++listEpochRef.current;
    const seq = ++requestSeqRef.current;
    const sentExclude = currentCappedHidden();
    setListError(false);

    function requestIsCurrent(): boolean {
      return (
        epoch === listEpochRef.current &&
        archivedListFiltersEqual(requested, currentFilterRef.current)
      );
    }

    function failFirstPage() {
      if (!requestIsCurrent()) return;
      setListError(true);
    }

    void (
      isProjects
        ? listArchivedProjects({ query, range, sort, excludeIds: sentExclude })
        : projectId
          ? listArchivedCards({ projectId, query, range, sort, excludeIds: sentExclude })
          : Promise.resolve({ error: 'Unauthorized' as const })
    )
      .then((result) => {
        if (!requestIsCurrent()) return;
        if ('error' in result) {
          setListError(true);
          return;
        }
        if (isTooNarrow(sentExclude, pendingHiddenRef.current.staleExcludes)) {
          setListGeneration((current) => current + 1);
          return;
        }
        setListError(false);
        setListFilter(requested);
        if (isProjects && hasArchivedProjects(result.data)) {
          const items = result.data.projects.map(reviveArchivedProject);
          setProjects(items);
          adoptListCount(
            seq,
            result.data.totalCount,
            items.map((item) => item.id),
            result.data.hasMore,
            result.data.nextCursor,
            sentExclude,
          );
          const released = releaseAfterFirstPage(pendingHiddenRef.current, seq);
          pendingHiddenRef.current = released;
          setPendingHidden(released);
          startCountOnlyRef.current();
          return;
        }
        if (!isProjects && hasArchivedCards(result.data)) {
          const items = result.data.cards.map(reviveArchivedTask);
          setCards(items);
          adoptListCount(
            seq,
            result.data.totalCount,
            items.map((item) => item.id),
            result.data.hasMore,
            result.data.nextCursor,
            sentExclude,
          );
          const released = releaseAfterFirstPage(pendingHiddenRef.current, seq);
          pendingHiddenRef.current = released;
          setPendingHidden(released);
          startCountOnlyRef.current();
        }
      })
      .catch(() => {
        failFirstPage();
      });
    return () => {
      if (listEpochRef.current === epoch) {
        listEpochRef.current += 1;
      }
    };
  }, [paged, isProjects, projectId, query, range, sort, listGeneration]);

  useEffect(() => {
    if (!openCard || openCard.detailLoaded) return;
    const cardId = openCard.id;
    let cancelled = false;
    void getArchivedCardDetail({ cardId }).then((result) => {
      if (cancelled || 'error' in result) return;
      setCards((current) =>
        current.map((card) =>
          card.id === cardId
            ? {
                ...applyArchivedCardDetail(card, result.data),
              }
            : card,
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [openCard]);

  useEffect(() => {
    if (!openProject || openProject.detailLoaded) return;
    const id = openProject.id;
    let cancelled = false;
    void getArchivedProjectDetail({ projectId: id }).then((result) => {
      if (cancelled || 'error' in result) return;
      setProjects((current) =>
        current.map((project) =>
          project.id === id
            ? { ...project, description: result.data.description, detailLoaded: true }
            : project,
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [openProject]);

  async function loadOlder(cursor?: string) {
    if (!paged) {
      setLimit((current) => current + ARCHIVED_PAGE_SIZE);
      return;
    }
    if (listPending || !cursor) return;
    const requested = archivedListFilter(query, range, sort);
    const epoch = listEpochRef.current;
    const seq = ++requestSeqRef.current;
    const sentExclude = currentCappedHidden();
    const result = isProjects
      ? await listArchivedProjects({ query, range, sort, cursor, excludeIds: sentExclude })
      : projectId
        ? await listArchivedCards({
            projectId,
            query,
            range,
            sort,
            cursor,
            excludeIds: sentExclude,
          })
        : { error: 'Unauthorized' as const };
    if (epoch !== listEpochRef.current || 'error' in result) return;
    if (!archivedListFiltersEqual(requested, currentFilterRef.current)) return;
    if (isTooNarrow(sentExclude, pendingHiddenRef.current.staleExcludes)) {
      setListGeneration((current) => current + 1);
      return;
    }
    if (isProjects && hasArchivedProjects(result.data)) {
      const nextProjects = result.data.projects;
      setProjects((current) => {
        const seen = new Set(current.map((project) => project.id));
        return [
          ...current,
          ...nextProjects.map(reviveArchivedProject).filter((project) => !seen.has(project.id)),
        ];
      });
      adoptListCount(
        seq,
        result.data.totalCount,
        nextProjects.map((item) => item.id),
        result.data.hasMore,
        result.data.nextCursor,
        sentExclude,
      );
      startCountOnly();
      return;
    }
    if (!isProjects && hasArchivedCards(result.data)) {
      const nextCards = result.data.cards;
      setCards((current) => {
        const seen = new Set(current.map((card) => card.id));
        return [
          ...current,
          ...nextCards.map(reviveArchivedTask).filter((card) => !seen.has(card.id)),
        ];
      });
      adoptListCount(
        seq,
        result.data.totalCount,
        nextCards.map((item) => item.id),
        result.data.hasMore,
        result.data.nextCursor,
        sentExclude,
      );
      startCountOnly();
    }
  }

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectionMode(false);
  }, []);

  function changeRange(next: ArchivedDateRange) {
    setRange(next);
    setLimit(ARCHIVED_PAGE_SIZE);
    clearSelection();
    setOpenId(null);
    setSwipe(null);
  }

  function toggleSort() {
    setSort((current) => (current === 'date' ? 'name' : 'date'));
    setLimit(ARCHIVED_PAGE_SIZE);
    clearSelection();
    setOpenId(null);
    setSwipe(null);
  }

  function onSearchChange(value: string) {
    setQuery(value);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function enterSelection(id: string) {
    setSelectionMode(true);
    setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
    setSwipe(null);
    setOpenId(null);
  }

  function cardsByIds(ids: string[]): ArchivedTask[] {
    const wanted = new Set(ids);
    return cards.filter((card) => wanted.has(card.id));
  }

  function projectsByIds(ids: string[]): ArchivedProject[] {
    const wanted = new Set(ids);
    return projects.filter((project) => wanted.has(project.id));
  }

  function bumpCardGens(ids: string[]): Map<string, number> {
    const snapshot = new Map<string, number>();
    for (const id of ids) {
      const next = (cardGenRef.current.get(id) ?? 0) + 1;
      cardGenRef.current.set(id, next);
      snapshot.set(id, next);
    }
    return snapshot;
  }

  function gensAreCurrent(snapshot: Map<string, number>): boolean {
    return [...snapshot].every(([id, gen]) => cardGenRef.current.get(id) === gen);
  }

  function nextOpId() {
    opCounterRef.current += 1;
    return `op-${opCounterRef.current}`;
  }

  function applyHidden(updater: (current: PendingHiddenState) => PendingHiddenState) {
    const next = updater(pendingHiddenRef.current);
    pendingHiddenRef.current = next;
    setPendingHidden(next);
    return next;
  }

  function hideIds(opId: string, ids: string[]) {
    applyHidden((current) => hide(current, opId, ids));
    startCountOnly();
  }

  function unhideIds(opId: string, ids: string[]) {
    applyHidden((current) => unhide(current, opId, ids));
  }

  function confirmIds(opId: string) {
    applyHidden((current) => confirm(current, opId, requestSeqRef.current));
  }

  function collapseIfMissing(ids: string[]) {
    const accumulated = isProjects ? projectsRef.current : cardsRef.current;
    const present = new Set(accumulated.map((item) => item.id));
    if (ids.some((id) => !present.has(id))) {
      setListGeneration((current) => current + 1);
    }
  }

  function failHide(opId: string, ids: string[]) {
    unhideIds(opId, ids);
    startCountOnly();
    collapseIfMissing(ids);
  }

  /**
   * Optimistic archive writes: a superseded success is dropped. A failure
   * always rolls back that operation's own rows, even if a later write on
   * other cards has started. Do not gate failure handling on a global
   * generation — that is how a first restore that failed after a second
   * started left rows missing until reload.
   */
  function putCardsBack(removed: ArchivedTask[]) {
    setCards((current) => insertArchivedTasks(current, removed, sort));
  }

  function putProjectsBack(removed: ArchivedProject[]) {
    setProjects((current) => insertArchivedProjects(current, removed, sort));
  }

  function canRestoreIds(ids: string[]): boolean {
    if (isProjects) {
      return ids.length > 0 && projectsByIds(ids).every((project) => project.canAdminister);
    }
    return canAdminister && ids.length > 0;
  }

  async function runRestore(ids: string[]) {
    if (!canRestoreIds(ids)) return;
    const gens = bumpCardGens(ids);
    const opId = nextOpId();
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setOpenId((current) => (current && ids.includes(current) ? null : current));
    setSwipe(null);
    if (isProjects) {
      const removed = projectsByIds(ids);
      if (paged) {
        hideIds(opId, ids);
      } else {
        setProjects((current) => current.filter((project) => !ids.includes(project.id)));
      }
      const result = await restoreArchivedProjects({ projectIds: ids });
      if ('error' in result) {
        if (paged) failHide(opId, ids);
        else putProjectsBack(removed);
        setToast({ message: result.error, role: 'alert' });
        return;
      }
      if (paged) confirmIds(opId);
      if (!gensAreCurrent(gens)) return;
      const message =
        removed.length === 1 && removed[0]
          ? archivedCopy.projects.restoredOne(removed[0].title)
          : archivedCopy.projects.restoredMany(ids.length);
      setToast({
        message,
        role: 'status',
        onUndo: () => {
          void runUndoProjects(ids, removed, result.data.undoToken, opId);
        },
      });
      router.refresh();
      return;
    }
    if (!projectId) return;
    const removed = cardsByIds(ids);
    if (paged) {
      hideIds(opId, ids);
    } else {
      setCards((current) => current.filter((card) => !ids.includes(card.id)));
    }
    const result = await restoreArchivedCards({ projectId, cardIds: ids });
    if ('error' in result) {
      if (paged) failHide(opId, ids);
      else putCardsBack(removed);
      setToast({ message: result.error, role: 'alert' });
      return;
    }
    if (paged) confirmIds(opId);
    if (!gensAreCurrent(gens)) return;
    const message =
      removed.length === 1 && removed[0]
        ? archivedCopy.restoredOne(removed[0].title)
        : archivedCopy.restoredMany(ids.length);
    const undoToken = result.data.undoToken;
    setToast({
      message,
      role: 'status',
      onUndo: () => {
        void runUndo(ids, removed, undoToken, opId);
      },
    });
    router.refresh();
  }

  async function runUndo(
    ids: string[],
    removed: ArchivedTask[],
    token: string,
    restoreOpId: string,
  ) {
    const gens = bumpCardGens(ids);
    setToast(null);
    if (paged) unhideIds(restoreOpId, ids);
    putCardsBack(removed);
    const result = await rearchiveArchivedCards({ token });
    if ('error' in result) {
      if (paged) hideIds(nextOpId(), ids);
      else {
        setCards((current) => current.filter((card) => !ids.includes(card.id)));
      }
      setToast({ message: result.error, role: 'alert' });
      return;
    }
    if (paged) startCountOnly(pendingHiddenRef.current, true);
    if (!gensAreCurrent(gens)) return;
    router.refresh();
  }

  async function runUndoProjects(
    ids: string[],
    removed: ArchivedProject[],
    token: string,
    restoreOpId: string,
  ) {
    const gens = bumpCardGens(ids);
    setToast(null);
    if (paged) unhideIds(restoreOpId, ids);
    putProjectsBack(removed);
    const result = await rearchiveArchivedProjects({ token });
    if ('error' in result) {
      if (paged) hideIds(nextOpId(), ids);
      else {
        setProjects((current) => current.filter((project) => !ids.includes(project.id)));
      }
      setToast({ message: result.error, role: 'alert' });
      return;
    }
    if (paged) startCountOnly(pendingHiddenRef.current, true);
    if (!gensAreCurrent(gens)) return;
    router.refresh();
  }

  async function runDelete(ids: string[]) {
    if (!canAdminister || ids.length === 0 || !projectId) return;
    const gens = bumpCardGens(ids);
    const opId = nextOpId();
    const removed = cardsByIds(ids);
    setPendingDeleteIds(null);
    if (paged) hideIds(opId, ids);
    else setCards((current) => current.filter((card) => !ids.includes(card.id)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setOpenId((current) => (current && ids.includes(current) ? null : current));
    const result = await deleteArchivedCards({ projectId, cardIds: ids });
    if ('error' in result) {
      if (paged) failHide(opId, ids);
      else putCardsBack(removed);
      setToast({ message: result.error, role: 'alert' });
      return;
    }
    if (paged) confirmIds(opId);
    if (!gensAreCurrent(gens)) return;
    const message =
      removed.length === 1 && removed[0]
        ? archivedCopy.deletedOne(removed[0].title)
        : archivedCopy.deletedMany(ids.length);
    setToast({ message, role: 'alert' });
    router.refresh();
  }

  async function runDeleteProject(id: string, title: string) {
    const target = projects.find((project) => project.id === id);
    if (!target?.canAdminister) return;
    const gens = bumpCardGens([id]);
    const opId = nextOpId();
    setPendingDeleteIds(null);
    if (paged) hideIds(opId, [id]);
    else setProjects((current) => current.filter((project) => project.id !== id));
    setSelectedIds((current) => current.filter((item) => item !== id));
    setOpenId((current) => (current === id ? null : current));
    const result = await deleteArchivedProject({ projectId: id, title });
    if ('error' in result) {
      if (paged) failHide(opId, [id]);
      else putProjectsBack([target]);
      setToast({ message: result.error, role: 'alert' });
      return;
    }
    if (paged) confirmIds(opId);
    if (!gensAreCurrent(gens)) return;
    setToast({ message: archivedCopy.projects.deletedOne(target.title), role: 'alert' });
    router.refresh();
  }

  async function runExport(ids: string[], format: ArchivedExportFormat) {
    if (isProjects || !projectId || !projectTitle) return;
    const rows = cardsByIds(ids);
    if (rows.length === 0) return;
    const result = await loadArchivedExportDetails(ids, (cardIds) =>
      getArchivedCardsDetail({ projectId, cardIds }),
    );
    if ('error' in result) {
      setToast({ message: result.error, role: 'alert' });
      return;
    }
    const hydrated: ArchivedTask[] = [];
    for (const row of rows) {
      const detail = result.data[row.id];
      if (!detail) {
        setToast({ message: GENERIC_ERROR_MESSAGE, role: 'alert' });
        return;
      }
      hydrated.push(applyArchivedCardDetail(row, detail));
    }
    const filename = archivedExportFilename(projectTitle, format);
    if (format === 'csv') {
      downloadText(filename, archivedTasksCsv(hydrated), 'text/csv;charset=utf-8');
    } else {
      downloadText(
        filename,
        archivedTasksJson(hydrated, { id: projectId, title: projectTitle }),
        'application/json',
      );
    }
    setExportIds(null);
    setToast({ message: archivedCopy.exportToast(hydrated.length), role: 'status' });
  }

  const selectedCanRestore = canRestoreIds(selectedIds);
  const adminTitle = isProjects
    ? archivedCopy.projects.adminOnly
    : canAdminister
      ? undefined
      : archivedCopy.adminOnly;
  const countLabel = isProjects
    ? archivedProjectCountLabel(paged ? displayCount : filteredProjects.length)
    : archivedCountLabel(paged ? displayCount : filteredCards.length);
  const selectedLabel = isProjects
    ? archivedProjectSelectedLabel(selectedIds.length)
    : archivedSelectedLabel(selectedIds.length);
  const searchPlaceholder = isProjects
    ? archivedCopy.projects.searchPlaceholder
    : archivedCopy.searchPlaceholder;
  const searchAriaLabel = isProjects
    ? archivedCopy.projects.searchAriaLabel
    : archivedCopy.searchAriaLabel;
  const pendingDeleteProject =
    isProjects && pendingDeleteIds != null && pendingDeleteIds.length === 1
      ? (projects.find((project) => project.id === pendingDeleteIds[0]) ?? null)
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" aria-busy={listPending || undefined}>
      <ScreenHeader
        breadcrumb={
          <>
            <Link
              href={PROJECTS_PATH}
              className={cn(
                shellFocusClassName,
                'rounded-sm no-underline hover:text-muted-foreground',
              )}
            >
              {isProjects ? archivedCopy.projects.breadcrumbHome : archivedCopy.breadcrumbProjects}
            </Link>
            {isProjects || !projectId || !projectTitle ? (
              <>
                {' / '}
                <span>{archivedCopy.breadcrumbArchived}</span>
              </>
            ) : (
              <>
                {' / '}
                <Link
                  href={projectPath(projectId)}
                  className={cn(
                    shellFocusClassName,
                    'rounded-sm no-underline hover:text-muted-foreground',
                  )}
                >
                  {projectTitle}
                </Link>
                {' / '}
                <span>{archivedCopy.breadcrumbArchived}</span>
              </>
            )}
          </>
        }
        title={archivedCopy.title}
        subtitle={<span className={cn(listPending && 'opacity-60')}>{countLabel}</span>}
      >
        <div className="hidden items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-[11px] lg:flex">
          <Clock className="size-[15px] shrink-0 text-subtle" strokeWidth={1.5} />
          <p className="text-[13px] text-muted-foreground text-pretty">
            {isProjects
              ? archivedCopy.projects.contextBand
              : archivedCopy.contextBand(projectTitle ?? '')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap gap-[3px] rounded-md border border-border bg-surface p-[3px]">
            {RANGES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => changeRange(key)}
                className={cn(
                  shellFocusClassName,
                  'h-7 rounded-xs px-[11px] text-[12.5px] font-medium',
                  range === key ? 'bg-card text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className="tablet:hidden">{archivedCopy.ranges[key].short}</span>
                <span className="hidden tablet:inline">{archivedCopy.ranges[key].label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleSort}
            aria-label={sort === 'date' ? archivedCopy.sortDate : archivedCopy.sortName}
            className={cn(
              shellFocusClassName,
              'inline-flex size-[38px] items-center justify-center rounded-md border border-border bg-surface text-muted-foreground tablet:h-[34px] tablet:w-auto tablet:px-3 tablet:text-[12.5px] tablet:font-medium',
            )}
          >
            <ArrowUpDown className="size-4 tablet:hidden" strokeWidth={1.8} />
            <span className="hidden tablet:inline">
              {sort === 'date' ? archivedCopy.sortDate : archivedCopy.sortName}
            </span>
          </button>
          {filtersOn ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                changeRange('all');
              }}
              className={cn(
                shellFocusClassName,
                'h-[34px] rounded-md px-3 text-[12.5px] font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {archivedCopy.clearFilters}
            </button>
          ) : null}
        </div>
        <label className="relative lg:hidden">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            {...searchFieldDomProps}
            value={query}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            className={cn(
              shellFocusClassName,
              'h-10 w-full overflow-hidden rounded-md border border-input bg-surface pr-3 pl-9 text-base text-foreground placeholder:text-subtle',
            )}
          />
        </label>
      </ScreenHeader>

      {selectionMode ? (
        <div className="flex items-center gap-2 rounded-md border border-border-strong bg-card px-3.5 py-2.5 lg:hidden">
          <button
            type="button"
            aria-label={archivedCopy.exitSelection}
            onClick={clearSelection}
            className={cn(
              shellFocusClassName,
              'inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground',
            )}
          >
            <X className="size-4" />
          </button>
          <p className="mr-auto text-[14.5px] font-semibold">
            {archivedPhoneSelectedLabel(selectedIds.length)}
          </p>
          <button
            type="button"
            onClick={() => setSelectedIds(allShownSelected ? [] : shown.map((card) => card.id))}
            className={cn(shellFocusClassName, 'text-[13px] font-medium')}
          >
            {allShownSelected ? archivedCopy.selectNone : archivedCopy.selectAllShort}
          </button>
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="hidden items-center gap-2 rounded-md border border-border-strong bg-card px-3.5 py-2.5 lg:flex">
          <p className="mr-auto text-[13px]">{selectedLabel}</p>
          <button
            type="button"
            disabled={!selectedCanRestore}
            title={selectedCanRestore ? undefined : adminTitle}
            onClick={() => void runRestore(selectedIds)}
            className={cn(
              shellFocusClassName,
              'h-[30px] rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background disabled:opacity-50',
            )}
          >
            {archivedCopy.restore}
          </button>
          {isProjects ? null : (
            <button
              type="button"
              onClick={() => setExportIds(selectedIds)}
              className={cn(
                shellFocusClassName,
                'h-[30px] rounded-md border border-border px-3 text-[12.5px] font-medium',
              )}
            >
              {archivedCopy.export}
            </button>
          )}
          {isProjects ? null : (
            <button
              type="button"
              disabled={!canAdminister}
              title={adminTitle}
              onClick={() => setPendingDeleteIds(selectedIds)}
              className={cn(
                shellFocusClassName,
                'h-[30px] rounded-md border border-danger-edge px-3 text-[12.5px] font-medium text-danger disabled:opacity-50',
              )}
            >
              {archivedCopy.delete}
            </button>
          )}
          <button
            type="button"
            aria-label={archivedCopy.clearSelection}
            onClick={clearSelection}
            className={cn(shellFocusClassName, 'inline-flex size-7 items-center justify-center')}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {shown.length === 0 && !listPending ? (
        <ArchivedEmptyState
          projectTitle={projectTitle}
          filtered={filtersOn}
          empty={isProjects ? ARCHIVED_PROJECTS_EMPTY : undefined}
          onClear={() => {
            onSearchChange('');
            changeRange('all');
          }}
        />
      ) : shown.length === 0 ? null : (
        <div
          inert={listPending || undefined}
          className={cn(
            'overflow-hidden rounded-md border border-border bg-card',
            listPending && 'opacity-60',
          )}
        >
          <div className="hidden grid-cols-[30px_minmax(0,1fr)_104px_88px_96px_120px_156px] gap-2.5 bg-surface px-4 py-[11px] text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase lg:grid">
            <input
              type="checkbox"
              checked={allShownSelected}
              disabled={listPending}
              aria-label={archivedCopy.selectAll}
              onChange={() =>
                rowLive
                  ? setSelectedIds(allShownSelected ? [] : shown.map((item) => item.id))
                  : undefined
              }
              className="size-[17px] rounded-xs border border-border-strong accent-foreground"
            />
            {isProjects ? (
              <>
                <span>{archivedCopy.projects.headers.name}</span>
                <span>{archivedCopy.projects.headers.status}</span>
                <span>{archivedCopy.projects.headers.progress}</span>
                <span>{archivedCopy.projects.headers.team}</span>
                <span>{archivedCopy.projects.headers.archived}</span>
              </>
            ) : (
              <>
                <span>{archivedCopy.headers.name}</span>
                <span>{archivedCopy.headers.column}</span>
                <span>{archivedCopy.headers.subtasks}</span>
                <span>{archivedCopy.headers.assignees}</span>
                <span>{archivedCopy.headers.archived}</span>
              </>
            )}
            <span />
          </div>
          <div className="tablet:hidden">
            {shown.map((item) => (
              <ArchivedRow
                key={`phone-${item.id}`}
                card={isProjects ? undefined : (item as ArchivedTask)}
                project={isProjects ? (item as ArchivedProject) : undefined}
                selected={selectedIds.includes(item.id)}
                selectionMode={selectionMode}
                swipeEnabled={rowLive}
                canAdminister={isProjects ? (item as ArchivedProject).canAdminister : canAdminister}
                dx={rowLive && swipe?.id === item.id ? swipe.dx : 0}
                tween={rowLive && swipe?.id === item.id ? swipe.tween : false}
                onOpen={rowLive ? () => setOpenId(item.id) : () => {}}
                onToggleSelect={rowLive ? () => toggleSelected(item.id) : () => {}}
                onRestore={rowLive ? () => void runRestore([item.id]) : () => {}}
                onExport={rowLive ? () => setExportIds([item.id]) : () => {}}
                onDelete={rowLive ? () => setPendingDeleteIds([item.id]) : () => {}}
                onLongPress={rowLive ? () => enterSelection(item.id) : () => {}}
                onSwipeChange={
                  rowLive ? (dx) => setSwipe({ id: item.id, dx, tween: false }) : () => {}
                }
                onSwipeEnd={
                  rowLive
                    ? (dx) => setSwipe(dx === 0 ? null : { id: item.id, dx, tween: true })
                    : () => {}
                }
              />
            ))}
          </div>
          <div className="hidden tablet:block">
            {shown.map((item) => (
              <ArchivedRow
                key={`wide-${item.id}`}
                card={isProjects ? undefined : (item as ArchivedTask)}
                project={isProjects ? (item as ArchivedProject) : undefined}
                selected={selectedIds.includes(item.id)}
                selectionMode={selectionMode}
                swipeEnabled={false}
                canAdminister={isProjects ? (item as ArchivedProject).canAdminister : canAdminister}
                dx={0}
                tween={false}
                onOpen={rowLive ? () => setOpenId(item.id) : () => {}}
                onToggleSelect={rowLive ? () => toggleSelected(item.id) : () => {}}
                onRestore={rowLive ? () => void runRestore([item.id]) : () => {}}
                onExport={rowLive ? () => setExportIds([item.id]) : () => {}}
                onDelete={rowLive ? () => setPendingDeleteIds([item.id]) : () => {}}
                onLongPress={rowLive ? () => enterSelection(item.id) : () => {}}
                onSwipeChange={() => {}}
                onSwipeEnd={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {paged && listPending && listError ? (
        <div className="flex flex-col items-center gap-2">
          <p role="alert" className="text-sm text-destructive">
            {GENERIC_ERROR_MESSAGE}
          </p>
          <button
            type="button"
            onClick={() => setListGeneration((current) => current + 1)}
            className={cn(
              shellFocusClassName,
              'h-11 w-full rounded-md border border-border bg-surface text-[13px] font-medium tablet:mx-auto tablet:w-auto tablet:px-5',
            )}
          >
            {archivedCopy.retry}
          </button>
        </div>
      ) : paged && !listPending ? (
        <LoadMore
          hasMore={hasMore}
          nextCursor={nextCursor}
          onLoadMore={(cursor) => loadOlder(cursor)}
          label={archivedCopy.loadMore}
          className={cn(
            shellFocusClassName,
            'h-11 w-full rounded-md border border-border bg-surface text-[13px] font-medium tablet:mx-auto tablet:w-auto tablet:px-5 disabled:opacity-50',
          )}
        />
      ) : remaining > 0 ? (
        <button
          type="button"
          onClick={() => void loadOlder()}
          className={cn(
            shellFocusClassName,
            'h-11 w-full rounded-md border border-border bg-surface text-[13px] font-medium tablet:mx-auto tablet:w-auto tablet:px-5',
          )}
        >
          {archivedCopy.loadOlder(remaining)}
        </button>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="sticky bottom-2 z-20 flex items-center gap-2 rounded-md border border-border-strong bg-card px-3.5 py-2.5 max-tablet:bottom-[calc(var(--spacing-mobile-tab-bar-clearance)+0.5rem)] lg:hidden">
          <p className="mr-auto text-[13px]">{selectedLabel}</p>
          <button
            type="button"
            disabled={!selectedCanRestore}
            title={selectedCanRestore ? undefined : adminTitle}
            onClick={() => void runRestore(selectedIds)}
            className={cn(
              shellFocusClassName,
              'h-9 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background disabled:opacity-50',
            )}
          >
            {archivedCopy.restore}
          </button>
          {isProjects ? null : (
            <button
              type="button"
              onClick={() => setExportIds(selectedIds)}
              className={cn(
                shellFocusClassName,
                'h-9 rounded-md border border-border px-3 text-[12.5px] font-medium',
              )}
            >
              {archivedCopy.export}
            </button>
          )}
          {isProjects ? null : (
            <button
              type="button"
              disabled={!canAdminister}
              title={adminTitle}
              onClick={() => setPendingDeleteIds(selectedIds)}
              className={cn(
                shellFocusClassName,
                'h-9 rounded-md border border-danger-edge px-3 text-[12.5px] font-medium text-danger disabled:opacity-50',
              )}
            >
              {archivedCopy.delete}
            </button>
          )}
        </div>
      ) : null}

      {openCard ? (
        <ArchivedDetail
          card={openCard}
          canAdminister={canAdminister}
          onClose={() => setOpenId(null)}
          onRestore={() => void runRestore([openCard.id])}
          onExport={() => setExportIds([openCard.id])}
          onDelete={() => setPendingDeleteIds([openCard.id])}
        />
      ) : null}
      {openProject ? (
        <ArchivedDetail
          project={openProject}
          canAdminister={openProject.canAdminister}
          onClose={() => setOpenId(null)}
          onRestore={() => void runRestore([openProject.id])}
          onExport={() => {}}
          onDelete={() => setPendingDeleteIds([openProject.id])}
        />
      ) : null}

      {isProjects ? (
        <ArchivedDeleteProjectDialog
          open={pendingDeleteProject != null}
          title={pendingDeleteProject?.title ?? null}
          onCancel={() => setPendingDeleteIds(null)}
          onConfirm={(typedTitle) => {
            if (pendingDeleteProject) void runDeleteProject(pendingDeleteProject.id, typedTitle);
          }}
        />
      ) : (
        <ArchivedDeleteDialog
          open={pendingDeleteIds != null && pendingDeleteIds.length > 0}
          names={cardsByIds(pendingDeleteIds ?? []).map((card) => card.title)}
          onCancel={() => setPendingDeleteIds(null)}
          onConfirm={() => {
            if (pendingDeleteIds) void runDelete(pendingDeleteIds);
          }}
        />
      )}
      {isProjects ? null : (
        <ArchivedExportDialog
          open={exportIds != null && exportIds.length > 0}
          onCancel={() => setExportIds(null)}
          onPick={(format) => {
            if (exportIds) void runExport(exportIds, format);
          }}
        />
      )}
      <BoardToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
