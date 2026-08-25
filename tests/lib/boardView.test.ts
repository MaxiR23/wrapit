// tests/lib/boardView.test.ts
//
// Tests for board filter, search, and visibility view-state helpers.
//
// Tested:
// - Empty filters leave the card list unchanged
// - Selected labels match any of those ids (OR)
// - Only-mine and only-overdue each narrow the list, and combine with AND
// - Search matches title or label case-insensitively and ANDs with filters
// - Cards without a due date are not overdue; unlabeled cards miss a label query
// - Reads a due moment by instant while a calendar day keeps the local-day rule
// - The badge counts active groups, not selected labels
// - Summary lists applied groups and the visible count
// - Unknown label ids are dropped after a label delete
// - No-results is true only when the project has cards and none remain visible
//
// What is covered:
// - Filter groups, search, badge, summary, prune, empty vs no-results
//
// Run with: pnpm test:run tests/lib/boardView.test.ts
//
// SEE: src/lib/boardView.ts

import { describe, expect, it } from 'vitest';

import {
  activeFilterGroupCount,
  boardFilterSummary,
  boardHasNoResults,
  DEFAULT_BOARD_VISIBILITY,
  emptyBoardFilters,
  filterBoardCards,
  pruneBoardFilterLabelIds,
  type BoardFilterCard,
} from '@/lib/boardView';

const now = new Date(Date.UTC(2026, 7, 24, 15, 0, 0));
const yesterday = new Date(Date.UTC(2026, 7, 23));
const tomorrow = new Date(Date.UTC(2026, 7, 25));

const ada = { id: 'user-ada', name: 'Ada', username: 'ada' };
const ben = { id: 'user-ben', name: 'Ben', username: 'ben' };

const design = { id: 'label-design', name: 'Design', tone: 'blue' as const };
const bug = { id: 'label-bug', name: 'Bug', tone: 'red' as const };

function card(
  partial: Partial<BoardFilterCard> & Pick<BoardFilterCard, 'id' | 'title'>,
): BoardFilterCard {
  return {
    code: 'WB-1',
    dueDate: null,
    ...partial,
  };
}

const cards: BoardFilterCard[] = [
  card({
    id: 'card-mine-design',
    title: 'Draw the board',
    label: design,
    assignees: [ada],
  }),
  card({
    id: 'card-ben-bug',
    title: 'Fix the queue',
    label: bug,
    assignees: [ben],
    dueDate: yesterday,
  }),
  card({
    id: 'card-unlabeled',
    title: 'Write docs',
    assignees: [ada, ben],
    dueDate: tomorrow,
  }),
];

const labels = [
  { id: design.id, name: design.name },
  { id: bug.id, name: bug.name },
];

describe('emptyBoardFilters and defaults', () => {
  it('starts with no labels and both checkboxes off', () => {
    expect(emptyBoardFilters()).toEqual({
      labelIds: [],
      onlyMine: false,
      onlyOverdue: false,
    });
    expect(DEFAULT_BOARD_VISIBILITY).toEqual({
      label: true,
      code: true,
      comments: true,
      subtasks: true,
      dueDate: true,
      assignees: true,
    });
  });
});

describe('filterBoardCards', () => {
  it('returns every card when filters and search are empty', () => {
    expect(
      filterBoardCards({
        cards,
        filters: emptyBoardFilters(),
        query: '',
        currentUserId: ada.id,
        now,
      }).map((item) => item.id),
    ).toEqual(['card-mine-design', 'card-ben-bug', 'card-unlabeled']);
  });

  it('keeps cards that carry any of the selected labels', () => {
    expect(
      filterBoardCards({
        cards,
        filters: { ...emptyBoardFilters(), labelIds: [design.id, bug.id] },
        query: '  ',
        currentUserId: ada.id,
        now,
      }).map((item) => item.id),
    ).toEqual(['card-mine-design', 'card-ben-bug']);
  });

  it('narrows further with only-mine and only-overdue', () => {
    expect(
      filterBoardCards({
        cards,
        filters: { labelIds: [bug.id], onlyMine: false, onlyOverdue: true },
        query: '',
        currentUserId: ada.id,
        now,
      }).map((item) => item.id),
    ).toEqual(['card-ben-bug']);

    expect(
      filterBoardCards({
        cards,
        filters: { labelIds: [], onlyMine: true, onlyOverdue: false },
        query: '',
        currentUserId: ada.id,
        now,
      }).map((item) => item.id),
    ).toEqual(['card-mine-design', 'card-unlabeled']);
  });

  it('matches title or label case-insensitively and ANDs with filters', () => {
    expect(
      filterBoardCards({
        cards,
        filters: { ...emptyBoardFilters(), onlyMine: true },
        query: 'BOARD',
        currentUserId: ada.id,
        now,
      }).map((item) => item.id),
    ).toEqual(['card-mine-design']);

    expect(
      filterBoardCards({
        cards,
        filters: emptyBoardFilters(),
        query: 'bug',
        currentUserId: ada.id,
        now,
      }).map((item) => item.id),
    ).toEqual(['card-ben-bug']);
  });

  it('does not treat a missing due date as overdue or match an unlabeled card on a label query', () => {
    expect(
      filterBoardCards({
        cards,
        filters: { ...emptyBoardFilters(), onlyOverdue: true },
        query: '',
        currentUserId: ada.id,
        now,
      }).map((item) => item.id),
    ).toEqual(['card-ben-bug']);

    expect(
      filterBoardCards({
        cards,
        filters: emptyBoardFilters(),
        query: 'design',
        currentUserId: ada.id,
        now,
      }).map((item) => item.id),
    ).toEqual(['card-mine-design']);
  });
});

describe('only-overdue with a due moment', () => {
  // now is 2026-08-24 15:00 UTC, so a moment at 14:00 UTC has passed while a
  // moment at 16:00 UTC has not, even though both fall on that same day.
  const passed = card({
    id: 'card-passed',
    title: 'Passed moment',
    dueDate: new Date(Date.UTC(2026, 7, 24, 14, 0)),
    dueTimeZone: 'Europe/Madrid',
  });
  const ahead = card({
    id: 'card-ahead',
    title: 'Upcoming moment',
    dueDate: new Date(Date.UTC(2026, 7, 24, 16, 0)),
    dueTimeZone: 'Europe/Madrid',
  });

  it('reads a moment by instant, not by calendar day', () => {
    expect(
      filterBoardCards({
        cards: [passed, ahead],
        filters: { ...emptyBoardFilters(), onlyOverdue: true },
        query: '',
        currentUserId: ada.id,
        now,
      }).map((item) => item.id),
    ).toEqual(['card-passed']);
  });

  it('leaves the calendar-day rule in place for a card with no zone', () => {
    expect(
      filterBoardCards({
        cards: [
          card({ id: 'card-today', title: 'Due today', dueDate: new Date(Date.UTC(2026, 7, 24)) }),
        ],
        filters: { ...emptyBoardFilters(), onlyOverdue: true },
        query: '',
        currentUserId: ada.id,
        now,
      }),
    ).toEqual([]);
  });
});

describe('activeFilterGroupCount', () => {
  it('counts one group for any selected labels, not one per label', () => {
    expect(activeFilterGroupCount(emptyBoardFilters())).toBe(0);
    expect(
      activeFilterGroupCount({
        labelIds: [design.id, bug.id],
        onlyMine: false,
        onlyOverdue: false,
      }),
    ).toBe(1);
    expect(
      activeFilterGroupCount({ labelIds: [design.id], onlyMine: true, onlyOverdue: true }),
    ).toBe(3);
  });
});

describe('boardFilterSummary', () => {
  it('lists applied groups and the visible count', () => {
    expect(
      boardFilterSummary({
        filters: { labelIds: [design.id, bug.id], onlyMine: true, onlyOverdue: true },
        labels,
        visibleCount: 2,
        totalCount: 9,
      }),
    ).toBe('Filtering by Design, Bug · only my cards · only overdue — 2 of 9 cards');
  });
});

describe('pruneBoardFilterLabelIds', () => {
  it('drops label ids that are no longer in the project', () => {
    expect(
      pruneBoardFilterLabelIds(
        { labelIds: [design.id, 'gone'], onlyMine: true, onlyOverdue: false },
        [{ id: design.id }],
      ),
    ).toEqual({ labelIds: [design.id], onlyMine: true, onlyOverdue: false });
  });
});

describe('boardHasNoResults', () => {
  it('is true only when the project has cards and none remain visible', () => {
    expect(boardHasNoResults({ totalCount: 3, visibleCount: 0 })).toBe(true);
    expect(boardHasNoResults({ totalCount: 0, visibleCount: 0 })).toBe(false);
    expect(boardHasNoResults({ totalCount: 3, visibleCount: 1 })).toBe(false);
  });
});
