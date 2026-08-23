export type ItemsByColumn = Record<string, string[]>;

export type MoveCommit = {
  cardId: string;
  targetColumnId: string;
};

function cloneItems(items: ItemsByColumn): ItemsByColumn {
  const next: ItemsByColumn = {};
  for (const [columnId, ids] of Object.entries(items)) {
    next[columnId] = [...ids];
  }
  return next;
}

/** Column id that currently holds the card, if any. */
export function findContainer(items: ItemsByColumn, cardId: string): string | undefined {
  return Object.keys(items).find((columnId) => items[columnId]?.includes(cardId));
}

/**
 * Moves `cardId` to the end of `targetColumnId`. Already in that column
 * keeps its place (no intra-column reorder).
 */
export function placeCardInColumn(
  items: ItemsByColumn,
  cardId: string,
  targetColumnId: string,
): ItemsByColumn {
  if (findContainer(items, cardId) === targetColumnId) {
    return cloneItems(items);
  }
  const next = cloneItems(items);
  for (const columnId of Object.keys(next)) {
    next[columnId] = (next[columnId] ?? []).filter((id) => id !== cardId);
  }
  if (!(targetColumnId in next)) {
    next[targetColumnId] = [];
  }
  next[targetColumnId] = [...(next[targetColumnId] ?? []), cardId];
  return next;
}

/** Commit when the card changes column; null when it is already there. */
export function commitMoveToColumn(
  items: ItemsByColumn,
  cardId: string,
  targetColumnId: string,
): { items: ItemsByColumn; commit: MoveCommit | null } {
  const sourceColumnId = findContainer(items, cardId);
  if (!sourceColumnId || !(targetColumnId in items)) {
    return { items, commit: null };
  }
  if (sourceColumnId === targetColumnId) {
    return { items, commit: null };
  }
  return {
    items: placeCardInColumn(items, cardId, targetColumnId),
    commit: { cardId, targetColumnId },
  };
}
