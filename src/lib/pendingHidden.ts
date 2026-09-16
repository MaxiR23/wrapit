export type HiddenEntry = {
  opId: string;
  confirmedSeq: number | null;
};

export type PendingHiddenState = {
  byId: Map<string, HiddenEntry>;
  staleExcludes: Set<string>;
};

export type CountKind = 'list' | 'count';

export function emptyPendingHidden(): PendingHiddenState {
  return { byId: new Map(), staleExcludes: new Set() };
}

function cloneState(state: PendingHiddenState): PendingHiddenState {
  return {
    byId: new Map(state.byId),
    staleExcludes: new Set(state.staleExcludes),
  };
}

export function hiddenIds(state: PendingHiddenState): string[] {
  return [...state.byId.keys()];
}

export function opOwns(state: PendingHiddenState, opId: string, ids: string[]): boolean {
  return ids.every((id) => state.byId.get(id)?.opId === opId);
}

export function hide(state: PendingHiddenState, opId: string, ids: string[]): PendingHiddenState {
  const next = cloneState(state);
  for (const id of ids) {
    next.byId.set(id, { opId, confirmedSeq: null });
    next.staleExcludes.delete(id);
  }
  return next;
}

export function unhide(state: PendingHiddenState, opId: string, ids: string[]): PendingHiddenState {
  const next = cloneState(state);
  for (const id of ids) {
    if (next.byId.get(id)?.opId !== opId) continue;
    next.byId.delete(id);
    next.staleExcludes.add(id);
  }
  return next;
}

export function markStale(state: PendingHiddenState, ids: string[]): PendingHiddenState {
  const next = cloneState(state);
  for (const id of ids) next.staleExcludes.add(id);
  return next;
}

export function confirm(
  state: PendingHiddenState,
  opId: string,
  confirmedSeq: number,
): PendingHiddenState {
  const next = cloneState(state);
  for (const [id, entry] of next.byId) {
    if (entry.opId !== opId) continue;
    next.byId.set(id, { ...entry, confirmedSeq });
  }
  return next;
}

export function releaseAfterFirstPage(
  state: PendingHiddenState,
  firstPageSeq: number,
): PendingHiddenState {
  const next = cloneState(state);
  for (const [id, entry] of next.byId) {
    if (entry.confirmedSeq == null || entry.confirmedSeq >= firstPageSeq) continue;
    next.byId.delete(id);
  }
  return next;
}

export function cappedExcludeIds(ids: Iterable<string>, cap: number): string[] {
  return [...new Set(ids)]
    .slice()
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .slice(0, cap);
}

export function excludeSetKey(ids: readonly string[]): string {
  return ids.join('\0');
}

export function isTooNarrow(
  sentExcludeIds: Iterable<string>,
  staleExcludes: ReadonlySet<string>,
): boolean {
  for (const id of sentExcludeIds) {
    if (staleExcludes.has(id)) return true;
  }
  return false;
}

export function shownCount(input: {
  totalCount: number;
  lastPageIds: ReadonlySet<string>;
  hiddenIds: Iterable<string>;
  exactExcludeIds: ReadonlySet<string>;
  countKind: CountKind;
}): number {
  if (input.countKind === 'count') {
    return Math.max(0, input.totalCount);
  }
  let subtract = 0;
  for (const id of input.hiddenIds) {
    if (input.exactExcludeIds.has(id)) continue;
    if (input.lastPageIds.has(id)) subtract += 1;
  }
  return Math.max(0, input.totalCount - subtract);
}

export function countWriterIsAmbiguous(input: {
  cappedHiddenIds: readonly string[];
  exactExcludeIds: ReadonlySet<string>;
  kind: CountKind;
  lastPageIds: ReadonlySet<string>;
}): boolean {
  for (const id of input.cappedHiddenIds) {
    if (input.exactExcludeIds.has(id)) continue;
    if (input.kind === 'list' && input.lastPageIds.has(id)) continue;
    return true;
  }
  return false;
}
