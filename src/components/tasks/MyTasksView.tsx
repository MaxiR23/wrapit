'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { setCardCompleted } from '@/actions/setCardCompleted';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import { useProjectsSearch } from '@/components/projects/ProjectsSearch';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  useViewerTimeZone,
  ViewerTimeZoneProvider,
} from '@/components/projects/ViewerTimeZoneProvider';
import MyTaskRow from '@/components/tasks/MyTaskRow';
import MyTasksDetail from '@/components/tasks/MyTasksDetail';
import NewTaskPopover from '@/components/tasks/NewTaskPopover';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import {
  filterCompletedMyTasks,
  filterOpenMyTasks,
  groupMyTasks,
  matchesMyTaskProject,
  matchesMyTaskSearch,
  myTaskProjectChips,
  myTasksEmptyCopy,
  myTasksEmptyKind,
  myTasksHasLate,
  myTasksSummary,
  taskDueGroup,
  type MyTask,
  type MyTasksCreateProject,
  type MyTasksPeriod,
} from '@/lib/myTasks';
import { cn } from '@/lib/utils';

const PERIODS: Array<{ id: Exclude<MyTasksPeriod, 'overdue'>; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'all', label: 'All' },
];

function reviveTask(task: MyTask): MyTask {
  return {
    ...task,
    dueDate: task.dueDate == null ? null : new Date(task.dueDate),
  };
}

export default function MyTasksView({
  initialTasks,
  createProjects,
  now,
}: {
  initialTasks: MyTask[];
  createProjects: MyTasksCreateProject[];
  now?: Date;
}) {
  return (
    <ViewerTimeZoneProvider>
      <MyTasksViewBody initialTasks={initialTasks} createProjects={createProjects} now={now} />
    </ViewerTimeZoneProvider>
  );
}

function MyTasksViewBody({
  initialTasks,
  createProjects,
  now: nowProp,
}: {
  initialTasks: MyTask[];
  createProjects: MyTasksCreateProject[];
  now?: Date;
}) {
  const router = useRouter();
  const { query } = useProjectsSearch();
  const { setOpenPanel } = useOpenPanel();
  const viewerTimeZone = useViewerTimeZone();
  const [now] = useState(() => nowProp ?? new Date());
  const completeGenRef = useRef(new Map<string, number>());
  const [tasks, setTasks] = useState(() => initialTasks.map(reviveTask));
  const [tasksSource, setTasksSource] = useState(initialTasks);
  const [period, setPeriod] = useState<MyTasksPeriod>('all');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [lateHidden, setLateHidden] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  if (initialTasks !== tasksSource) {
    setTasksSource(initialTasks);
    setTasks(initialTasks.map(reviveTask));
  }

  const chips = myTaskProjectChips(tasks);
  const hasLate = myTasksHasLate(tasks, query, projectId, now, viewerTimeZone);
  const openFiltered = filterOpenMyTasks({
    tasks,
    query,
    projectId,
    period,
    now,
    viewerTimeZone,
  });
  const completedFiltered = filterCompletedMyTasks({ tasks, query, projectId });
  const groups = groupMyTasks(openFiltered, now, viewerTimeZone, period);
  const openMatchingSearchAndProject = tasks.filter(
    (task) =>
      !task.completed && matchesMyTaskSearch(task, query) && matchesMyTaskProject(task, projectId),
  ).length;
  const emptyKind = myTasksEmptyKind({
    openGroups: groups.length,
    query,
    openMatchingSearchAndProject,
    completedMatching: completedFiltered.length,
  });
  const lateCount = tasks.filter((task) => {
    if (task.completed) return false;
    if (!matchesMyTaskSearch(task, query)) return false;
    if (!matchesMyTaskProject(task, projectId)) return false;
    return taskDueGroup(task, now, viewerTimeZone) === 'overdue';
  }).length;
  const detail = detailId ? (tasks.find((task) => task.id === detailId) ?? null) : null;

  function openDetail(id: string) {
    setOpenPanel(null);
    setDetailId(id);
  }

  async function toggleComplete(task: MyTask, completed: boolean, closeDetail = false) {
    const generation = (completeGenRef.current.get(task.id) ?? 0) + 1;
    completeGenRef.current.set(task.id, generation);
    const previous = task;
    setError(null);
    setPendingIds((current) => new Set(current).add(task.id));
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, completed } : item)),
    );
    if (closeDetail) setDetailId(null);
    const result = await setCardCompleted({ cardId: task.id, completed });
    if (completeGenRef.current.get(task.id) !== generation) return;
    if ('error' in result) {
      setTasks((current) => current.map((item) => (item.id === task.id ? previous : item)));
      setError(result.error === 'Unauthorized' ? GENERIC_ERROR_MESSAGE : result.error);
      if (closeDetail) setDetailId(task.id);
    } else {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, completed, columnId: result.data.columnId } : item,
        ),
      );
      router.refresh();
    }
    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
  }

  function handleCreated(task: MyTask) {
    setTasks((current) => [task, ...current]);
    router.refresh();
  }

  const segmentClass = (active: boolean) =>
    cn(
      shellFocusClassName,
      'h-[38px] rounded-[6px] px-[13px] text-sm font-medium tablet:h-8 tablet:text-[13px]',
      active ? 'bg-card text-foreground' : 'text-muted-foreground',
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 tablet:flex-row tablet:items-end tablet:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="hidden text-[23px] font-semibold tracking-[-0.025em] tablet:block lg:text-[27px]">
            My tasks
          </h1>
          <p className="text-[13px] text-muted-foreground tablet:text-[12.5px] lg:text-[13px]">
            {myTasksSummary(openFiltered, now)}
          </p>
        </div>
        <div className="relative flex items-center gap-2">
          <div className="flex flex-1 gap-[3px] rounded-md border border-border bg-surface p-[3px] tablet:flex-none">
            {hasLate ? (
              <button
                type="button"
                onClick={() => setPeriod('overdue')}
                className={cn(
                  segmentClass(period === 'overdue'),
                  'hidden text-late tablet:inline-flex tablet:items-center tablet:gap-1.5',
                  period === 'overdue' && 'bg-card',
                )}
              >
                Overdue
                <span className="rounded-full bg-danger-soft px-1.5 text-[11px] text-late">
                  {lateCount}
                </span>
              </button>
            ) : null}
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={cn(segmentClass(period === item.id), 'flex-1 tablet:flex-none')}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="New task"
            onClick={() => {
              setOpenPanel(null);
              setCreateOpen(true);
            }}
            className={cn(
              shellFocusClassName,
              'inline-flex size-[46px] items-center justify-center rounded-md bg-primary text-[13.5px] font-semibold text-primary-foreground',
              'tablet:size-10 lg:h-9 lg:w-auto lg:gap-1.5 lg:px-[15px]',
            )}
          >
            <Plus className="size-[15px]" strokeWidth={2.2} />
            <span className="hidden lg:inline">New task</span>
          </button>
          {createOpen ? (
            <NewTaskPopover
              open
              onOpenChange={setCreateOpen}
              projects={createProjects}
              onCreated={handleCreated}
            />
          ) : null}
        </div>
      </header>

      {hasLate && !lateHidden ? (
        <div className="flex h-[46px] items-center gap-2 rounded-md border border-border px-3.5 text-late tablet:hidden">
          <button
            type="button"
            onClick={() => setPeriod('overdue')}
            className={cn(
              shellFocusClassName,
              'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left',
              period === 'overdue' && 'rounded-md bg-danger-soft',
            )}
          >
            <AlertTriangle className="size-[17px] shrink-0" strokeWidth={1.8} />
            <span className="text-sm font-medium">Overdue</span>
          </button>
          <button
            type="button"
            aria-label="Hide overdue"
            onClick={() => {
              setLateHidden(true);
              if (period === 'overdue') setPeriod('today');
            }}
            className={cn(shellFocusClassName, 'inline-flex size-11 items-center justify-center')}
          >
            <X className="size-[15px]" />
          </button>
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex gap-[7px] overflow-x-auto">
          <Chip label="All" active={projectId == null} onClick={() => setProjectId(null)} />
          {chips.map((chip) => (
            <Chip
              key={chip.id}
              label={chip.title}
              active={projectId === chip.id}
              onClick={() => setProjectId(chip.id)}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      {emptyKind ? (
        <EmptyState kind={emptyKind} query={query} />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              {group.showHeader ? (
                <header className="flex items-center gap-2">
                  <h2
                    className={cn(
                      'text-[12.5px] font-semibold tracking-[0.02em]',
                      group.key === 'overdue' ? 'text-late' : 'text-foreground',
                    )}
                  >
                    {group.title}
                  </h2>
                  <span className="rounded-full border border-border bg-surface px-2 py-px text-[11.5px] text-muted-foreground">
                    {group.tasks.length}
                  </span>
                  {group.note ? <span className="text-xs text-subtle">{group.note}</span> : null}
                </header>
              ) : null}
              <div className="flex flex-col gap-2">
                {group.tasks.map((task) => (
                  <MyTaskRow
                    key={task.id}
                    task={task}
                    active={detailId === task.id}
                    pending={pendingIds.has(task.id)}
                    onOpen={() => openDetail(task.id)}
                    onToggleComplete={() => void toggleComplete(task, true)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {completedFiltered.length > 0 ? (
        <section className="flex flex-col gap-2">
          <header className="flex items-center gap-2">
            <h2 className="text-[12.5px] font-semibold tracking-[0.02em]">Completed</h2>
            <span className="rounded-full border border-border bg-surface px-2 py-px text-[11.5px] text-muted-foreground">
              {completedFiltered.length}
            </span>
          </header>
          <div className="flex flex-col gap-2">
            {completedFiltered.map((task) => (
              <MyTaskRow
                key={task.id}
                task={task}
                completed
                pending={pendingIds.has(task.id)}
                onOpen={() => openDetail(task.id)}
                onToggleComplete={() => void toggleComplete(task, false)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {detail ? (
        <MyTasksDetail
          task={detail}
          pending={pendingIds.has(detail.id)}
          onClose={() => setDetailId(null)}
          onToggleComplete={() => void toggleComplete(detail, !detail.completed, true)}
        />
      ) : null}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        shellFocusClassName,
        'h-7 shrink-0 rounded-full border px-[11px] text-[12.5px] font-medium',
        active
          ? 'border-border-strong bg-card text-foreground'
          : 'border-border bg-transparent text-muted-foreground',
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({
  kind,
  query,
}: {
  kind: NonNullable<ReturnType<typeof myTasksEmptyKind>>;
  query: string;
}) {
  const copy = myTasksEmptyCopy(kind, query);
  return (
    <div className="flex flex-col items-center rounded-[12px] border border-dashed border-border px-4 py-11 text-center tablet:py-[52px] lg:py-16">
      <p className="text-base font-semibold">{copy.title}</p>
      <p className="mt-1 max-w-[340px] text-[13.5px] text-muted-foreground">{copy.note}</p>
    </div>
  );
}
