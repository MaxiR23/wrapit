// tests/lib/pendingHidden.test.ts
//
// Tests for the pending-hidden-ids reducer used by paged lists.
//
// Tested:
// - Hide owns ids; a later hide on the same id supersedes
// - Unhide only if the op still owns the id, and marks those ids stale
// - markStale records ids even when no op owns them
// - Release after a later first page drops confirmed hides without staling
// - Late unhide or confirm of a superseded op changes nothing
// - shownCount subtracts last-page hidden ids only for a list writer
// - A count-only writer does not subtract lastPageIds
// - Capped exclude ids are sorted and truncated; the tail is not ambiguous
//
// What is covered:
// - Ownership, stale vs released, count derivation, cap
//
// Run with: pnpm test:run tests/lib/pendingHidden.test.ts
//
// SEE: src/lib/pendingHidden.ts

import { describe, it, expect } from 'vitest';

import {
  cappedExcludeIds,
  confirm,
  countWriterIsAmbiguous,
  emptyPendingHidden,
  hide,
  hiddenIds,
  isTooNarrow,
  markStale,
  opOwns,
  releaseAfterFirstPage,
  shownCount,
  unhide,
} from '@/lib/pendingHidden';

describe('pendingHidden', () => {
  it('lets a later hide supersede an earlier op on the same id', () => {
    let state = emptyPendingHidden();
    state = hide(state, 'op-1', ['a', 'b']);
    state = hide(state, 'op-2', ['a']);
    expect(opOwns(state, 'op-1', ['a', 'b'])).toBe(false);
    expect(opOwns(state, 'op-1', ['b'])).toBe(true);
    expect(opOwns(state, 'op-2', ['a'])).toBe(true);
    expect(hiddenIds(state).sort()).toEqual(['a', 'b']);
  });

  it('unhides only ids the op still owns and marks them stale', () => {
    let state = hide(emptyPendingHidden(), 'op-1', ['a', 'b']);
    state = hide(state, 'op-2', ['a']);
    state = unhide(state, 'op-1', ['a', 'b']);
    expect(hiddenIds(state)).toEqual(['a']);
    expect(state.staleExcludes.has('b')).toBe(true);
    expect(state.staleExcludes.has('a')).toBe(false);
  });

  it('marks ids stale even when no op owns them', () => {
    const state = markStale(emptyPendingHidden(), ['released']);
    expect(state.staleExcludes.has('released')).toBe(true);
    expect(hiddenIds(state)).toEqual([]);
  });

  it('does not stale ids released after a confirmed first page', () => {
    let state = hide(emptyPendingHidden(), 'op-1', ['a']);
    state = confirm(state, 'op-1', 1);
    state = releaseAfterFirstPage(state, 2);
    expect(hiddenIds(state)).toEqual([]);
    expect(state.staleExcludes.has('a')).toBe(false);
  });

  it('ignores late unhide and confirm of a superseded op', () => {
    let state = hide(emptyPendingHidden(), 'op-1', ['a']);
    state = hide(state, 'op-2', ['a']);
    const afterUnhide = unhide(state, 'op-1', ['a']);
    expect(hiddenIds(afterUnhide)).toEqual(['a']);
    expect(afterUnhide.staleExcludes.has('a')).toBe(false);
    const afterConfirm = confirm(state, 'op-1', 3);
    expect(afterConfirm.byId.get('a')?.confirmedSeq).toBeNull();
  });

  it('does not treat a load more that excluded a released id as too narrow', () => {
    expect(isTooNarrow(['released'], new Set())).toBe(false);
  });

  it('treats a response that excluded an unhidden id as too narrow', () => {
    const state = unhide(hide(emptyPendingHidden(), 'op-1', ['a']), 'op-1', ['a']);
    expect(isTooNarrow(['a'], state.staleExcludes)).toBe(true);
  });
});

describe('shownCount and ambiguity', () => {
  it('subtracts a hidden id on a list page that still contains it', () => {
    expect(
      shownCount({
        totalCount: 10,
        lastPageIds: new Set(['x']),
        hiddenIds: ['x'],
        exactExcludeIds: new Set(),
        countKind: 'list',
      }),
    ).toBe(9);
  });

  it('does not subtract leftover lastPageIds after a count-only writer', () => {
    expect(
      shownCount({
        totalCount: 8,
        lastPageIds: new Set(['x', 'y']),
        hiddenIds: ['x', 'y'],
        exactExcludeIds: new Set(['x']),
        countKind: 'count',
      }),
    ).toBe(8);
  });

  it('treats a count-only writer as exact only for the ids it sent', () => {
    expect(
      countWriterIsAmbiguous({
        cappedHiddenIds: ['x', 'y'],
        exactExcludeIds: new Set(['x']),
        kind: 'count',
        lastPageIds: new Set(['x', 'y']),
      }),
    ).toBe(true);
    expect(
      countWriterIsAmbiguous({
        cappedHiddenIds: ['x', 'y'],
        exactExcludeIds: new Set(['x', 'y']),
        kind: 'count',
        lastPageIds: new Set(),
      }),
    ).toBe(false);
  });

  it('does not treat a list page that still contains the hidden id as ambiguous', () => {
    expect(
      countWriterIsAmbiguous({
        cappedHiddenIds: ['x'],
        exactExcludeIds: new Set(),
        kind: 'list',
        lastPageIds: new Set(['x']),
      }),
    ).toBe(false);
  });

  it('sorts and truncates capped exclude ids so the tail is not ambiguous', () => {
    const ids = Array.from({ length: 201 }, (_, index) => `id-${String(index).padStart(3, '0')}`);
    const capped = cappedExcludeIds(ids, 200);
    expect(capped).toHaveLength(200);
    expect(capped[0]).toBe('id-000');
    expect(capped[199]).toBe('id-199');
    expect(
      countWriterIsAmbiguous({
        cappedHiddenIds: capped,
        exactExcludeIds: new Set(capped),
        kind: 'count',
        lastPageIds: new Set(),
      }),
    ).toBe(false);
  });
});
