import { isCardDueLate } from '@/lib/cardDue';

export type BoardFilters = {
  labelIds: string[];
  onlyMine: boolean;
  onlyOverdue: boolean;
};

export type BoardVisibility = {
  label: boolean;
  code: boolean;
  comments: boolean;
  subtasks: boolean;
  dueDate: boolean;
  assignees: boolean;
};

export const BOARD_VISIBILITY_FIELDS = [
  { key: 'label', label: 'Label' },
  { key: 'code', label: 'Card code' },
  { key: 'comments', label: 'Comments' },
  { key: 'subtasks', label: 'Subtasks' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'assignees', label: 'Assignees' },
] as const satisfies ReadonlyArray<{ key: keyof BoardVisibility; label: string }>;

export type BoardFilterCard = {
  id: string;
  title: string;
  code: string;
  dueDate: Date | null;
  assignees?: Array<{ id: string }>;
  label?: { id: string; name: string } | null;
};

export const DEFAULT_BOARD_VISIBILITY: BoardVisibility = {
  label: true,
  code: true,
  comments: true,
  subtasks: true,
  dueDate: true,
  assignees: true,
};

export function emptyBoardFilters(): BoardFilters {
  return { labelIds: [], onlyMine: false, onlyOverdue: false };
}

export function activeFilterGroupCount(filters: BoardFilters): number {
  return (
    (filters.labelIds.length > 0 ? 1 : 0) +
    (filters.onlyMine ? 1 : 0) +
    (filters.onlyOverdue ? 1 : 0)
  );
}

function matchesQuery(card: BoardFilterCard, needle: string): boolean {
  if (!needle) return true;
  if (card.title.toLowerCase().includes(needle)) return true;
  return (card.label?.name ?? '').toLowerCase().includes(needle);
}

export function filterBoardCards({
  cards,
  filters,
  query,
  currentUserId,
  now = new Date(),
}: {
  cards: BoardFilterCard[];
  filters: BoardFilters;
  query: string;
  currentUserId: string;
  now?: Date;
}): BoardFilterCard[] {
  const needle = query.trim().toLowerCase();
  return cards.filter((card) => {
    if (filters.labelIds.length > 0) {
      const labelId = card.label?.id;
      if (!labelId || !filters.labelIds.includes(labelId)) return false;
    }
    if (filters.onlyMine) {
      const assignees = card.assignees ?? [];
      if (!assignees.some((member) => member.id === currentUserId)) return false;
    }
    if (filters.onlyOverdue) {
      if (card.dueDate == null || !isCardDueLate(card.dueDate, now)) return false;
    }
    return matchesQuery(card, needle);
  });
}

export function boardFilterSummary({
  filters,
  labels,
  visibleCount,
  totalCount,
}: {
  filters: BoardFilters;
  labels: Array<{ id: string; name: string }>;
  visibleCount: number;
  totalCount: number;
}): string {
  const names = filters.labelIds
    .map((id) => labels.find((label) => label.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const parts: string[] = [];
  if (names.length > 0) parts.push(names.join(', '));
  if (filters.onlyMine) parts.push('only my cards');
  if (filters.onlyOverdue) parts.push('only overdue');
  return `Filtering by ${parts.join(' · ')} — ${visibleCount} of ${totalCount} cards`;
}

export function pruneBoardFilterLabelIds(
  filters: BoardFilters,
  labels: Array<{ id: string }>,
): BoardFilters {
  const known = new Set(labels.map((label) => label.id));
  return { ...filters, labelIds: filters.labelIds.filter((id) => known.has(id)) };
}

export function boardHasNoResults({
  totalCount,
  visibleCount,
}: {
  totalCount: number;
  visibleCount: number;
}): boolean {
  return totalCount > 0 && visibleCount === 0;
}
