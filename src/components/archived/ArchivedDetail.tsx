'use client';

import { useEffect } from 'react';
import { Check, Download, Trash2, X } from 'lucide-react';

import CardMarkdown from '@/components/cards/CardMarkdown';
import { archivedCopy } from '@/lib/archivedCopy';
import {
  archivedByLine,
  archivedProjectDetailLine,
  archivedTaskDetailLine,
  formatArchivedDate,
  type ArchivedProject,
  type ArchivedTask,
} from '@/lib/archived';
import { commentCount, subtaskProgress } from '@/lib/cardCounters';
import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';

export default function ArchivedDetail({
  card,
  project,
  canAdminister,
  onClose,
  onRestore,
  onExport,
  onDelete,
}: {
  card?: ArchivedTask;
  project?: ArchivedProject;
  canAdminister: boolean;
  onClose: () => void;
  onRestore: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const item = project ?? card;
  if (!item) return null;

  const by = archivedByLine(item);
  const archivedValue = by
    ? `${formatArchivedDate(item.archivedAt)} ${by}`
    : formatArchivedDate(item.archivedAt);
  const isProject = project != null;
  const copy = isProject ? archivedCopy.projects : archivedCopy;
  const title = isProject ? project.title : (card?.title ?? '');
  const context = isProject
    ? archivedProjectDetailLine(project)
    : `${card?.label ? `${card.label.name} · ` : ''}${card ? archivedTaskDetailLine(card) : ''}`;
  const progress = card ? subtaskProgress(card.subtasks) : null;

  return (
    <div className="contents">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[55] bg-black/34"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="archived-detail-title"
        className={cn(
          'fixed z-[60] flex flex-col bg-surface',
          'inset-x-0 bottom-0 max-h-[86%] rounded-t-[16px] border-t border-border-strong',
          'tablet:inset-y-0 tablet:right-0 tablet:left-auto tablet:max-h-none tablet:w-[340px] tablet:rounded-none tablet:border-t-0 tablet:border-l',
          'lg:w-[392px]',
          'shadow-[0_-12px_40px_oklch(0_0_0/0.35)] tablet:shadow-[-24px_0_60px_oklch(0_0_0/0.45)]',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border tablet:hidden" />
        <header className="flex items-start gap-2 border-b border-border px-4 py-4 tablet:px-5 lg:px-[22px]">
          <div className="mr-auto min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.05em] text-subtle uppercase">
              {copy.kicker}
            </p>
            <h2
              id="archived-detail-title"
              className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-pretty"
            >
              {card ? <CardMarkdown text={card.title} variant="inline" /> : title}
            </h2>
            <p className="mt-1 truncate text-[12.5px] text-subtle">{context}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={cn(
              shellFocusClassName,
              'inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-card-hover hover:text-foreground',
            )}
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4 tablet:px-5 lg:px-[22px]">
          <p className="rounded-md bg-background px-3 py-2.5 text-[12.5px] text-muted-foreground">
            {copy.readOnly}
          </p>
          {project ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
                  {archivedCopy.projects.finalStatus}
                </dt>
                <dd className="mt-1 text-[13px]">{project.statusLabel}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
                  {archivedCopy.projects.progress}
                </dt>
                <dd className="mt-1 text-[13px] tabular-nums">{project.percent}%</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
                  {archivedCopy.projects.team}
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {project.members.map((member) => (
                    <span
                      key={member.id}
                      title={member.name || member.username}
                      className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[9px] font-semibold"
                    >
                      {initials(member.name, member.username)}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
                  {archivedCopy.archived}
                </dt>
                <dd className="mt-1 text-[13px]">{archivedValue}</dd>
              </div>
            </dl>
          ) : card && progress ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
                  {archivedCopy.columnWhenArchived}
                </dt>
                <dd className="mt-1 text-[13px]">{card.column.title}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
                  {archivedCopy.subtasks}
                </dt>
                <dd className="mt-1 text-[13px] tabular-nums">
                  {progress.done}/{progress.total}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
                  {archivedCopy.archived}
                </dt>
                <dd className="mt-1 text-[13px]">{archivedValue}</dd>
              </div>
            </dl>
          ) : null}
          {project && project.description ? (
            <section className="mt-5">
              <ul className="mt-2 flex flex-col gap-2">
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-[5px] shrink-0 rounded-full bg-muted-foreground" />
                  <span className="text-[13px] text-pretty">{project.description}</span>
                </li>
              </ul>
            </section>
          ) : null}
          {project && project.columns.length > 0 ? (
            <ul className="mt-5 flex flex-col gap-2">
              {project.columns.map((column) => (
                <li key={column.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-[5px] shrink-0 rounded-full bg-muted-foreground" />
                  <span className="text-[13px]">
                    {column.title}
                    {column.cardCount > 0
                      ? ` · ${column.cardCount === 1 ? '1 card' : `${column.cardCount} cards`}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {card && card.subtasks.length > 0 ? (
            <section className="mt-5">
              <h3 className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
                {archivedCopy.subtasks}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {card.subtasks.map((subtask) => (
                  <li key={subtask.id} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border',
                        subtask.done
                          ? 'border-foreground bg-foreground text-primary-foreground'
                          : 'border-border-strong',
                      )}
                    >
                      {subtask.done ? <Check className="size-2.5" strokeWidth={3} /> : null}
                    </span>
                    <span
                      className={cn(
                        'text-[13px]',
                        subtask.done ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {subtask.text}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {card && card.comments.length > 0 ? (
            <section className="mt-5">
              <h3 className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
                {archivedCopy.comments(commentCount(card.comments))}
              </h3>
              <ul className="mt-2 flex flex-col gap-3">
                {card.comments.map((comment) => (
                  <li key={comment.id} className="flex items-start gap-2.5">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {initials(comment.author.name, comment.author.username)}
                    </span>
                    <div className="text-[13px] text-pretty">
                      <CardMarkdown text={comment.body} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <footer className="flex items-center gap-2 border-t border-border px-4 py-3 tablet:px-5">
          <button
            type="button"
            disabled={!canAdminister}
            title={canAdminister ? undefined : copy.adminOnly}
            onClick={onRestore}
            className={cn(
              shellFocusClassName,
              'h-11 flex-1 rounded-md bg-foreground text-[13px] font-medium text-background tablet:h-10',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {archivedCopy.restore}
          </button>
          {isProject ? null : (
            <button
              type="button"
              aria-label={archivedCopy.export}
              onClick={onExport}
              className={cn(
                shellFocusClassName,
                'inline-flex size-11 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-card-hover tablet:size-10',
              )}
            >
              <Download className="size-4" strokeWidth={1.8} />
            </button>
          )}
          <button
            type="button"
            disabled={!canAdminister}
            title={canAdminister ? undefined : copy.adminOnly}
            aria-label={archivedCopy.delete}
            onClick={onDelete}
            className={cn(
              shellFocusClassName,
              'inline-flex size-11 items-center justify-center rounded-md border border-transparent text-danger hover:border-danger-edge hover:bg-danger-soft tablet:size-10',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Trash2 className="size-4" strokeWidth={1.8} />
          </button>
        </footer>
      </aside>
    </div>
  );
}
