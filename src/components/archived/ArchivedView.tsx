'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, Clock, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { getArchivedCardDetail } from '@/actions/getArchivedCardDetail';
import { getArchivedCardsDetail } from '@/actions/getArchivedCardsDetail';
import { getArchivedProjectDetail } from '@/actions/getArchivedProjectDetail';
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
import BoardToast, { type BoardToastMessage } from '@/components/projects/BoardToast';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  ARCHIVED_PAGE_SIZE,
  ARCHIVED_PROJECTS_EMPTY,
  applyArchivedCardDetail,
  archivedCountLabel,
  archivedListCursorFromItem,
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
  type ArchivedProject,
  type ArchivedSort,
  type ArchivedTask,
} from '@/lib/archived';
import { archivedCopy } from '@/lib/archivedCopy';
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
}): data is { projects: ArchivedProject[]; totalCount: number } {
  return Array.isArray(data.projects);
}

function hasArchivedCards(data: {
  projects?: unknown;
  cards?: unknown;
  totalCount: number;
}): data is { cards: ArchivedTask[]; totalCount: number } {
  return Array.isArray(data.cards);
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
  canAdminister = false,
}: {
  projectId?: string;
  projectTitle?: string;
  initialCards?: ArchivedTask[];
  initialProjects?: ArchivedProject[];
  initialTotalCount?: number;
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; dx: number; tween: boolean } | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [exportIds, setExportIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState<BoardToastMessage | null>(null);
  const [now] = useState(() => new Date());
  const cardGenRef = useRef(new Map<string, number>());
  const skipNextListFetch = useRef(archivedListIsDefault(query, range, sort));
  const listEpochRef = useRef(0);
  const filterFetchInFlightRef = useRef(false);
  const restartFilterFetchRef = useRef(false);
  const [listGeneration, setListGeneration] = useState(0);
  const [queryEpoch, setQueryEpoch] = useState(query);
  if (query !== queryEpoch) {
    setQueryEpoch(query);
    setLimit(ARCHIVED_PAGE_SIZE);
    setSelectedIds([]);
    setSelectionMode(false);
  }

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
        shown: isProjects ? filteredProjects : filteredCards,
        remaining: Math.max(0, totalCount - (isProjects ? projects.length : cards.length)),
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

  useEffect(() => {
    if (!paged) return;
    if (skipNextListFetch.current) {
      skipNextListFetch.current = false;
      return;
    }
    const epoch = ++listEpochRef.current;
    filterFetchInFlightRef.current = true;
    void (
      isProjects
        ? listArchivedProjects({ query, range, sort })
        : projectId
          ? listArchivedCards({ projectId, query, range, sort })
          : Promise.resolve({ error: 'Unauthorized' as const })
    ).then((result) => {
      if (epoch !== listEpochRef.current) return;
      filterFetchInFlightRef.current = false;
      if ('error' in result) return;
      if (isProjects && hasArchivedProjects(result.data)) {
        setProjects(result.data.projects.map(reviveArchivedProject));
        setTotalCount(result.data.totalCount);
        return;
      }
      if (!isProjects && hasArchivedCards(result.data)) {
        setCards(result.data.cards.map(reviveArchivedTask));
        setTotalCount(result.data.totalCount);
      }
    });
    return () => {
      filterFetchInFlightRef.current = false;
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

  async function loadOlder() {
    if (!paged) {
      setLimit((current) => current + ARCHIVED_PAGE_SIZE);
      return;
    }
    const epoch = listEpochRef.current;
    const loaded = isProjects ? projects : cards;
    const last = loaded[loaded.length - 1];
    const cursor = last ? archivedListCursorFromItem(last) : undefined;
    const result = isProjects
      ? await listArchivedProjects({ query, range, sort, ...(cursor ? { cursor } : {}) })
      : projectId
        ? await listArchivedCards({
            projectId,
            query,
            range,
            sort,
            ...(cursor ? { cursor } : {}),
          })
        : { error: 'Unauthorized' as const };
    if (epoch !== listEpochRef.current || 'error' in result) return;
    if (isProjects && hasArchivedProjects(result.data)) {
      const nextProjects = result.data.projects;
      const nextTotal = result.data.totalCount;
      setProjects((current) => {
        const seen = new Set(current.map((project) => project.id));
        return [
          ...current,
          ...nextProjects.map(reviveArchivedProject).filter((project) => !seen.has(project.id)),
        ];
      });
      setTotalCount(nextTotal);
      return;
    }
    if (!isProjects && hasArchivedCards(result.data)) {
      const nextCards = result.data.cards;
      const nextTotal = result.data.totalCount;
      setCards((current) => {
        const seen = new Set(current.map((card) => card.id));
        return [
          ...current,
          ...nextCards.map(reviveArchivedTask).filter((card) => !seen.has(card.id)),
        ];
      });
      setTotalCount(nextTotal);
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
  }

  function toggleSort() {
    setSort((current) => (current === 'date' ? 'name' : 'date'));
    setLimit(ARCHIVED_PAGE_SIZE);
    clearSelection();
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

  /**
   * Optimistic archive writes: a superseded success is dropped. A failure
   * always rolls back that operation's own rows, even if a later write on
   * other cards has started. Do not gate failure handling on a global
   * generation — that is how a first restore that failed after a second
   * started left rows missing until reload.
   */
  function putCardsBack(removed: ArchivedTask[]) {
    setCards((current) => insertArchivedTasks(current, removed, sort));
    if (paged) setTotalCount((current) => current + removed.length);
  }

  function putProjectsBack(removed: ArchivedProject[]) {
    setProjects((current) => insertArchivedProjects(current, removed, sort));
    if (paged) setTotalCount((current) => current + removed.length);
  }

  function canRestoreIds(ids: string[]): boolean {
    if (isProjects) {
      return ids.length > 0 && projectsByIds(ids).every((project) => project.canAdminister);
    }
    return canAdminister && ids.length > 0;
  }

  function invalidateInFlightList() {
    listEpochRef.current += 1;
    if (filterFetchInFlightRef.current) {
      restartFilterFetchRef.current = true;
      filterFetchInFlightRef.current = false;
    }
  }

  function restartFilterFetchIfNeeded() {
    if (!restartFilterFetchRef.current) return;
    restartFilterFetchRef.current = false;
    setListGeneration((current) => current + 1);
  }

  async function runRestore(ids: string[]) {
    if (!canRestoreIds(ids)) return;
    invalidateInFlightList();
    try {
      const gens = bumpCardGens(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setOpenId((current) => (current && ids.includes(current) ? null : current));
      setSwipe(null);
      if (isProjects) {
        const removed = projectsByIds(ids);
        setProjects((current) => current.filter((project) => !ids.includes(project.id)));
        if (paged) setTotalCount((current) => Math.max(0, current - removed.length));
        const result = await restoreArchivedProjects({ projectIds: ids });
        if ('error' in result) {
          putProjectsBack(removed);
          setToast({ message: result.error, role: 'alert' });
          return;
        }
        if (!gensAreCurrent(gens)) return;
        const message =
          removed.length === 1 && removed[0]
            ? archivedCopy.projects.restoredOne(removed[0].title)
            : archivedCopy.projects.restoredMany(ids.length);
        setToast({
          message,
          role: 'status',
          onUndo: () => {
            void runUndoProjects(ids, removed, result.data.undoToken);
          },
        });
        router.refresh();
        return;
      }
      if (!projectId) return;
      const removed = cardsByIds(ids);
      setCards((current) => current.filter((card) => !ids.includes(card.id)));
      if (paged) setTotalCount((current) => Math.max(0, current - removed.length));
      const result = await restoreArchivedCards({ projectId, cardIds: ids });
      if ('error' in result) {
        putCardsBack(removed);
        setToast({ message: result.error, role: 'alert' });
        return;
      }
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
          void runUndo(ids, removed, undoToken);
        },
      });
      router.refresh();
    } finally {
      restartFilterFetchIfNeeded();
    }
  }

  async function runUndo(ids: string[], removed: ArchivedTask[], token: string) {
    const gens = bumpCardGens(ids);
    invalidateInFlightList();
    try {
      setToast(null);
      putCardsBack(removed);
      const result = await rearchiveArchivedCards({ token });
      if ('error' in result) {
        setCards((current) => current.filter((card) => !ids.includes(card.id)));
        if (paged) setTotalCount((current) => Math.max(0, current - ids.length));
        setToast({ message: result.error, role: 'alert' });
        return;
      }
      if (!gensAreCurrent(gens)) return;
      router.refresh();
    } finally {
      restartFilterFetchIfNeeded();
    }
  }

  async function runUndoProjects(ids: string[], removed: ArchivedProject[], token: string) {
    const gens = bumpCardGens(ids);
    invalidateInFlightList();
    try {
      setToast(null);
      putProjectsBack(removed);
      const result = await rearchiveArchivedProjects({ token });
      if ('error' in result) {
        setProjects((current) => current.filter((project) => !ids.includes(project.id)));
        if (paged) setTotalCount((current) => Math.max(0, current - ids.length));
        setToast({ message: result.error, role: 'alert' });
        return;
      }
      if (!gensAreCurrent(gens)) return;
      router.refresh();
    } finally {
      restartFilterFetchIfNeeded();
    }
  }

  async function runDelete(ids: string[]) {
    if (!canAdminister || ids.length === 0 || !projectId) return;
    invalidateInFlightList();
    try {
      const gens = bumpCardGens(ids);
      const removed = cardsByIds(ids);
      setPendingDeleteIds(null);
      setCards((current) => current.filter((card) => !ids.includes(card.id)));
      if (paged) setTotalCount((current) => Math.max(0, current - removed.length));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setOpenId((current) => (current && ids.includes(current) ? null : current));
      const result = await deleteArchivedCards({ projectId, cardIds: ids });
      if ('error' in result) {
        putCardsBack(removed);
        setToast({ message: result.error, role: 'alert' });
        return;
      }
      if (!gensAreCurrent(gens)) return;
      const message =
        removed.length === 1 && removed[0]
          ? archivedCopy.deletedOne(removed[0].title)
          : archivedCopy.deletedMany(ids.length);
      setToast({ message, role: 'alert' });
      router.refresh();
    } finally {
      restartFilterFetchIfNeeded();
    }
  }

  async function runDeleteProject(id: string, title: string) {
    const target = projects.find((project) => project.id === id);
    if (!target?.canAdminister) return;
    invalidateInFlightList();
    try {
      const gens = bumpCardGens([id]);
      setPendingDeleteIds(null);
      setProjects((current) => current.filter((project) => project.id !== id));
      if (paged) setTotalCount((current) => Math.max(0, current - 1));
      setSelectedIds((current) => current.filter((item) => item !== id));
      setOpenId((current) => (current === id ? null : current));
      const result = await deleteArchivedProject({ projectId: id, title });
      if ('error' in result) {
        putProjectsBack([target]);
        setToast({ message: result.error, role: 'alert' });
        return;
      }
      if (!gensAreCurrent(gens)) return;
      setToast({ message: archivedCopy.projects.deletedOne(target.title), role: 'alert' });
      router.refresh();
    } finally {
      restartFilterFetchIfNeeded();
    }
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
    ? archivedProjectCountLabel(paged ? totalCount : filteredProjects.length)
    : archivedCountLabel(paged ? totalCount : filteredCards.length);
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
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
        subtitle={countLabel}
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

      {shown.length === 0 ? (
        <ArchivedEmptyState
          projectTitle={projectTitle}
          filtered={filtersOn}
          empty={isProjects ? ARCHIVED_PROJECTS_EMPTY : undefined}
          onClear={() => {
            onSearchChange('');
            changeRange('all');
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <div className="hidden grid-cols-[30px_minmax(0,1fr)_104px_88px_96px_120px_156px] gap-2.5 bg-surface px-4 py-[11px] text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase lg:grid">
            <input
              type="checkbox"
              checked={allShownSelected}
              aria-label={archivedCopy.selectAll}
              onChange={() => setSelectedIds(allShownSelected ? [] : shown.map((item) => item.id))}
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
                swipeEnabled
                canAdminister={isProjects ? (item as ArchivedProject).canAdminister : canAdminister}
                dx={swipe?.id === item.id ? swipe.dx : 0}
                tween={swipe?.id === item.id ? swipe.tween : false}
                onOpen={() => setOpenId(item.id)}
                onToggleSelect={() => toggleSelected(item.id)}
                onRestore={() => void runRestore([item.id])}
                onExport={() => setExportIds([item.id])}
                onDelete={() => setPendingDeleteIds([item.id])}
                onLongPress={() => enterSelection(item.id)}
                onSwipeChange={(dx) => setSwipe({ id: item.id, dx, tween: false })}
                onSwipeEnd={(dx) => setSwipe(dx === 0 ? null : { id: item.id, dx, tween: true })}
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
                onOpen={() => setOpenId(item.id)}
                onToggleSelect={() => toggleSelected(item.id)}
                onRestore={() => void runRestore([item.id])}
                onExport={() => setExportIds([item.id])}
                onDelete={() => setPendingDeleteIds([item.id])}
                onLongPress={() => enterSelection(item.id)}
                onSwipeChange={() => {}}
                onSwipeEnd={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {remaining > 0 ? (
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
