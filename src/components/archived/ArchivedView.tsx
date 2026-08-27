'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, Clock, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { deleteArchivedCards } from '@/actions/deleteArchivedCards';
import { rearchiveArchivedCards } from '@/actions/rearchiveArchivedCards';
import { restoreArchivedCards } from '@/actions/restoreArchivedCards';
import ArchivedDeleteDialog from '@/components/archived/ArchivedDeleteDialog';
import ArchivedDetail from '@/components/archived/ArchivedDetail';
import ArchivedEmptyState from '@/components/archived/ArchivedEmptyState';
import ArchivedExportDialog from '@/components/archived/ArchivedExportDialog';
import ArchivedRow from '@/components/archived/ArchivedRow';
import BoardToast, { type BoardToastMessage } from '@/components/projects/BoardToast';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  ARCHIVED_PAGE_SIZE,
  archivedCountLabel,
  archivedPhoneSelectedLabel,
  archivedSelectedLabel,
  filterArchivedTasks,
  reviveArchivedTask,
  sliceArchivedTasks,
  type ArchivedDateRange,
  type ArchivedSort,
  type ArchivedTask,
} from '@/lib/archived';
import { archivedCopy } from '@/lib/archivedCopy';
import {
  archivedExportFilename,
  archivedTasksCsv,
  archivedTasksJson,
  type ArchivedExportFormat,
} from '@/lib/archivedExport';
import { PROJECTS_PATH, projectPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

const RANGES: ArchivedDateRange[] = ['all', '7', '30', 'old'];

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
  initialCards,
  canAdminister,
}: {
  projectId: string;
  projectTitle: string;
  initialCards: ArchivedTask[];
  canAdminister: boolean;
}) {
  const router = useRouter();
  const { query, setQuery } = useProjectsSearch();
  const [cards, setCards] = useState(() => initialCards.map(reviveArchivedTask));
  const [range, setRange] = useState<ArchivedDateRange>('all');
  const [sort, setSort] = useState<ArchivedSort>('date');
  const [limit, setLimit] = useState(ARCHIVED_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; dx: number; tween: boolean } | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [exportIds, setExportIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState<BoardToastMessage | null>(null);
  const [now] = useState(() => new Date());
  const cardGenRef = useRef(new Map<string, number>());
  const [queryEpoch, setQueryEpoch] = useState(query);
  if (query !== queryEpoch) {
    setQueryEpoch(query);
    setLimit(ARCHIVED_PAGE_SIZE);
    setSelectedIds([]);
    setSelectionMode(false);
  }

  const filtered = useMemo(
    () => filterArchivedTasks(cards, { query, range, sort, now }),
    [cards, query, range, sort, now],
  );
  const { shown, remaining } = sliceArchivedTasks(filtered, limit);
  const selectedShown = shown.filter((card) => selectedIds.includes(card.id));
  const allShownSelected = shown.length > 0 && selectedShown.length === shown.length;
  const filtersOn = query.trim() !== '' || range !== 'all';
  const openCard = openId ? (cards.find((card) => card.id === openId) ?? null) : null;

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
    setCards((current) => {
      const existing = new Set(current.map((card) => card.id));
      return [...current, ...removed.filter((card) => !existing.has(card.id))];
    });
  }

  async function runRestore(ids: string[]) {
    if (!canAdminister || ids.length === 0) return;
    const removed = cardsByIds(ids);
    const gens = bumpCardGens(ids);
    setCards((current) => current.filter((card) => !ids.includes(card.id)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setOpenId((current) => (current && ids.includes(current) ? null : current));
    setSwipe(null);
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
  }

  async function runUndo(ids: string[], removed: ArchivedTask[], token: string) {
    const gens = bumpCardGens(ids);
    setToast(null);
    putCardsBack(removed);
    const result = await rearchiveArchivedCards({ token });
    if ('error' in result) {
      setCards((current) => current.filter((card) => !ids.includes(card.id)));
      setToast({ message: result.error, role: 'alert' });
      return;
    }
    if (!gensAreCurrent(gens)) return;
    router.refresh();
  }

  async function runDelete(ids: string[]) {
    if (!canAdminister || ids.length === 0) return;
    const gens = bumpCardGens(ids);
    const removed = cardsByIds(ids);
    setPendingDeleteIds(null);
    setCards((current) => current.filter((card) => !ids.includes(card.id)));
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
  }

  function runExport(ids: string[], format: ArchivedExportFormat) {
    const rows = cardsByIds(ids);
    if (rows.length === 0) return;
    const filename = archivedExportFilename(projectTitle, format);
    if (format === 'csv') {
      downloadText(filename, archivedTasksCsv(rows), 'text/csv;charset=utf-8');
    } else {
      downloadText(
        filename,
        archivedTasksJson(rows, { id: projectId, title: projectTitle }),
        'application/json',
      );
    }
    setExportIds(null);
    setToast({ message: archivedCopy.exportToast(rows.length), role: 'status' });
  }

  const adminTitle = canAdminister ? undefined : archivedCopy.adminOnly;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-col gap-4">
        <nav className="text-[12px] text-subtle">
          <Link
            href={PROJECTS_PATH}
            className={cn(
              shellFocusClassName,
              'rounded-sm no-underline hover:text-muted-foreground',
            )}
          >
            {archivedCopy.breadcrumbProjects}
          </Link>
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
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[15.5px] font-semibold tracking-[-0.025em] tablet:text-[23px] lg:text-[27px]">
              {archivedCopy.title}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {archivedCountLabel(filtered.length)}
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-[11px] lg:flex">
          <Clock className="size-[15px] shrink-0 text-subtle" strokeWidth={1.5} />
          <p className="text-[13px] text-muted-foreground text-pretty">
            {archivedCopy.contextBand(projectTitle)}
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
                  'h-7 rounded-[6px] px-[11px] text-[12.5px] font-medium',
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
            type="search"
            value={query}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={archivedCopy.searchPlaceholder}
            aria-label={archivedCopy.searchAriaLabel}
            className={cn(
              shellFocusClassName,
              'h-10 w-full rounded-md border border-input bg-surface pr-3 pl-9 text-base text-foreground placeholder:text-subtle',
            )}
          />
        </label>
      </header>

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
          <p className="mr-auto text-[13px]">{archivedSelectedLabel(selectedIds.length)}</p>
          <button
            type="button"
            disabled={!canAdminister}
            title={adminTitle}
            onClick={() => void runRestore(selectedIds)}
            className={cn(
              shellFocusClassName,
              'h-[30px] rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background disabled:opacity-50',
            )}
          >
            {archivedCopy.restore}
          </button>
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
          onClear={() => {
            onSearchChange('');
            changeRange('all');
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="hidden grid-cols-[30px_minmax(0,1fr)_104px_88px_96px_120px_156px] gap-2.5 bg-surface px-4 py-[11px] text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase lg:grid">
            <input
              type="checkbox"
              checked={allShownSelected}
              aria-label={archivedCopy.selectAll}
              onChange={() => setSelectedIds(allShownSelected ? [] : shown.map((card) => card.id))}
              className="size-[17px] rounded-[4px] border border-border-strong accent-foreground"
            />
            <span>{archivedCopy.headers.name}</span>
            <span>{archivedCopy.headers.column}</span>
            <span>{archivedCopy.headers.subtasks}</span>
            <span>{archivedCopy.headers.assignees}</span>
            <span>{archivedCopy.headers.archived}</span>
            <span />
          </div>
          <div className="tablet:hidden">
            {shown.map((card) => (
              <ArchivedRow
                key={`phone-${card.id}`}
                card={card}
                selected={selectedIds.includes(card.id)}
                selectionMode={selectionMode}
                swipeEnabled
                canAdminister={canAdminister}
                dx={swipe?.id === card.id ? swipe.dx : 0}
                tween={swipe?.id === card.id ? swipe.tween : false}
                onOpen={() => setOpenId(card.id)}
                onToggleSelect={() => toggleSelected(card.id)}
                onRestore={() => void runRestore([card.id])}
                onExport={() => setExportIds([card.id])}
                onDelete={() => setPendingDeleteIds([card.id])}
                onLongPress={() => enterSelection(card.id)}
                onSwipeChange={(dx) => setSwipe({ id: card.id, dx, tween: false })}
                onSwipeEnd={(dx) => setSwipe(dx === 0 ? null : { id: card.id, dx, tween: true })}
              />
            ))}
          </div>
          <div className="hidden tablet:block">
            {shown.map((card) => (
              <ArchivedRow
                key={`wide-${card.id}`}
                card={card}
                selected={selectedIds.includes(card.id)}
                selectionMode={selectionMode}
                swipeEnabled={false}
                canAdminister={canAdminister}
                dx={0}
                tween={false}
                onOpen={() => setOpenId(card.id)}
                onToggleSelect={() => toggleSelected(card.id)}
                onRestore={() => void runRestore([card.id])}
                onExport={() => setExportIds([card.id])}
                onDelete={() => setPendingDeleteIds([card.id])}
                onLongPress={() => enterSelection(card.id)}
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
          onClick={() => setLimit((current) => current + ARCHIVED_PAGE_SIZE)}
          className={cn(
            shellFocusClassName,
            'h-11 w-full rounded-md border border-border bg-surface text-[13px] font-medium tablet:mx-auto tablet:w-auto tablet:px-5',
          )}
        >
          {archivedCopy.loadOlder(remaining)}
        </button>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="sticky bottom-2 z-20 flex items-center gap-2 rounded-md border border-border-strong bg-card px-3.5 py-2.5 lg:hidden">
          <p className="mr-auto text-[13px]">{archivedSelectedLabel(selectedIds.length)}</p>
          <button
            type="button"
            disabled={!canAdminister}
            title={adminTitle}
            onClick={() => void runRestore(selectedIds)}
            className={cn(
              shellFocusClassName,
              'h-9 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background disabled:opacity-50',
            )}
          >
            {archivedCopy.restore}
          </button>
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

      <ArchivedDeleteDialog
        open={pendingDeleteIds != null && pendingDeleteIds.length > 0}
        names={cardsByIds(pendingDeleteIds ?? []).map((card) => card.title)}
        onCancel={() => setPendingDeleteIds(null)}
        onConfirm={() => {
          if (pendingDeleteIds) void runDelete(pendingDeleteIds);
        }}
      />
      <ArchivedExportDialog
        open={exportIds != null && exportIds.length > 0}
        onCancel={() => setExportIds(null)}
        onPick={(format) => {
          if (exportIds) runExport(exportIds, format);
        }}
      />
      <BoardToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
