export type ItemsByColumn = Record<string, string[]>;

export type MoveCommit = {
  cardId: string;
  targetColumnId: string;
  beforeCardId: string | null;
  afterCardId: string | null;
};

export type DragEndTransition = {
  items: ItemsByColumn;
  /** Null when the drop is a no-op or cancel (UI should match `items`). */
  commit: MoveCommit | null;
};

/** Column id that currently holds the card, if any. */
export function findContainer(items: ItemsByColumn, cardId: string): string | undefined {
  return Object.keys(items).find((columnId) => items[columnId]?.includes(cardId));
}

/** Column referred to by a droppable id (card id or column id). */
export function resolveOverContainer(items: ItemsByColumn, overId: string): string | undefined {
  if (overId in items) return overId;
  return findContainer(items, overId);
}

/** Neighbors around `index` in a column's card id list (for moveCard). */
export function neighborsAt(
  ids: string[],
  index: number,
): {
  beforeCardId: string | null;
  afterCardId: string | null;
} {
  return {
    beforeCardId: index > 0 ? (ids[index - 1] ?? null) : null,
    afterCardId: index < ids.length - 1 ? (ids[index + 1] ?? null) : null,
  };
}

function cloneItems(items: ItemsByColumn): ItemsByColumn {
  const next: ItemsByColumn = {};
  for (const [columnId, ids] of Object.entries(items)) {
    next[columnId] = [...ids];
  }
  return next;
}

function removeCard(items: ItemsByColumn, cardId: string): ItemsByColumn {
  const next = cloneItems(items);
  for (const columnId of Object.keys(next)) {
    next[columnId] = (next[columnId] ?? []).filter((id) => id !== cardId);
  }
  return next;
}

function moveArrayItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/**
 * Places `activeId` into `overContainer` relative to `overId`:
 * - over a different card → insert before that card
 * - over the column droppable / empty area → append at end
 */
export function placeCardAtOver(
  items: ItemsByColumn,
  activeId: string,
  overContainer: string,
  overId: string,
): ItemsByColumn {
  const next = removeCard(items, activeId);
  if (!(overContainer in next)) {
    next[overContainer] = [];
  }
  const dest = [...(next[overContainer] ?? [])];

  if (overId !== activeId && overId !== overContainer) {
    const overIndex = dest.indexOf(overId);
    if (overIndex >= 0) {
      dest.splice(overIndex, 0, activeId);
      next[overContainer] = dest;
      return next;
    }
  }

  dest.push(activeId);
  next[overContainer] = dest;
  return next;
}

/**
 * Same-column reorder matching dnd-kit sortable `arrayMove` when dropping on a
 * card; dropping on the column id appends to the end.
 */
export function reorderInColumn(
  items: ItemsByColumn,
  columnId: string,
  activeId: string,
  overId: string,
): ItemsByColumn {
  if (overId === activeId) return items;
  if (overId === columnId) {
    return placeCardAtOver(items, activeId, columnId, columnId);
  }

  const columnItems = items[columnId] ?? [];
  const from = columnItems.indexOf(activeId);
  const to = columnItems.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return items;

  return {
    ...items,
    [columnId]: moveArrayItem(columnItems, from, to),
  };
}

/**
 * Places `cardId` into `targetColumnId` between optional neighbors on a
 * persisted baseline. Prefers a neighbor that still exists (`before` then
 * `after`); if neither remains, appends.
 */
export function placeCardBetween(
  items: ItemsByColumn,
  cardId: string,
  targetColumnId: string,
  beforeCardId: string | null,
  afterCardId: string | null,
): ItemsByColumn {
  const next = removeCard(items, cardId);
  if (!(targetColumnId in next)) {
    next[targetColumnId] = [];
  }

  const dest = [...(next[targetColumnId] ?? [])];
  const beforeIndex = beforeCardId ? dest.indexOf(beforeCardId) : -1;
  const afterIndex = afterCardId ? dest.indexOf(afterCardId) : -1;

  let insertIndex = dest.length;
  if (beforeIndex >= 0) {
    insertIndex = beforeIndex + 1;
  } else if (afterIndex >= 0) {
    insertIndex = afterIndex;
  }

  dest.splice(insertIndex, 0, cardId);
  next[targetColumnId] = dest;
  return next;
}

function commitFromItems(
  startItems: ItemsByColumn,
  nextItems: ItemsByColumn,
  cardId: string,
  targetColumnId: string,
): MoveCommit | null {
  const destIds = nextItems[targetColumnId] ?? [];
  const newIndex = destIds.indexOf(cardId);
  if (newIndex === -1) return null;

  const startContainer = findContainer(startItems, cardId);
  const startIndex = startContainer ? (startItems[startContainer] ?? []).indexOf(cardId) : -1;
  if (startContainer === targetColumnId && startIndex === newIndex) {
    return null;
  }

  const { beforeCardId, afterCardId } = neighborsAt(destIds, newIndex);
  return { cardId, targetColumnId, beforeCardId, afterCardId };
}

/**
 * Pure drag-over transition. Updates list order for cross-column moves and for
 * repositioning inside a column the card did not start in. Same-column origin
 * hovers over cards leave state alone (sortable transforms); hovering the
 * column droppable still appends for empty-area preview.
 */
export function transitionDragOver(
  items: ItemsByColumn,
  startItems: ItemsByColumn,
  activeId: string,
  overId: string,
): ItemsByColumn {
  // dnd-kit may report overId === activeId after a cross-column insert; keep position.
  if (overId === activeId) return items;

  const overContainer = resolveOverContainer(items, overId);
  if (!overContainer) return items;

  const startContainer = findContainer(startItems, activeId);
  const activeContainer = findContainer(items, activeId);

  if (
    startContainer === overContainer &&
    activeContainer === overContainer &&
    overId !== overContainer
  ) {
    return items;
  }

  return placeCardAtOver(items, activeId, overContainer, overId);
}

/**
 * Pure drag-end transition. Produces the final board ids and an optional
 * persist commit. Cancel / invalid drop restores `startItems` with no commit.
 */
export function transitionDragEnd(
  startItems: ItemsByColumn,
  currentItems: ItemsByColumn,
  activeId: string,
  overId: string | null,
): DragEndTransition {
  if (overId == null) {
    return { items: startItems, commit: null };
  }

  // Hover/drop on the active card itself: keep the current preview position.
  if (overId === activeId) {
    const activeContainer = findContainer(currentItems, activeId);
    if (!activeContainer) {
      return { items: startItems, commit: null };
    }
    const commit = commitFromItems(startItems, currentItems, activeId, activeContainer);
    return { items: currentItems, commit };
  }

  const overContainer =
    resolveOverContainer(currentItems, overId) ?? resolveOverContainer(startItems, overId);
  if (!overContainer) {
    return { items: startItems, commit: null };
  }

  const startContainer = findContainer(startItems, activeId);
  const activeContainer = findContainer(currentItems, activeId);

  let nextItems: ItemsByColumn;

  if (startContainer === overContainer) {
    nextItems = reorderInColumn(currentItems, overContainer, activeId, overId);
  } else if (activeContainer === overContainer) {
    nextItems = placeCardAtOver(currentItems, activeId, overContainer, overId);
  } else {
    nextItems = placeCardAtOver(currentItems, activeId, overContainer, overId);
  }

  if (!findContainer(nextItems, activeId)) {
    return { items: startItems, commit: null };
  }

  const commit = commitFromItems(startItems, nextItems, activeId, overContainer);
  return { items: nextItems, commit };
}
