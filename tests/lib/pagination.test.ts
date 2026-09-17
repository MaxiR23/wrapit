// tests/lib/pagination.test.ts
//
// Tests for the shared server pagination module.
//
// Tested:
// - Exactly the page size of remaining rows returns hasMore false and
//   nextCursor null
// - One extra row beyond the page size returns hasMore true
// - Ties on the sort key are broken by id with no row skipped or repeated
// - A malformed cursor is rejected without fetching
// - A cursor whose sort field or direction does not match the request is
//   rejected without fetching
// - A cursor with a changed but otherwise valid anchor is rejected
// - A cursor signed with a different secret is rejected
//
// What is covered:
// - Page size boundary, id tie-break, opaque cursor validation
//
// Run with: pnpm test:run tests/lib/pagination.test.ts
//
// SEE: src/lib/pagination.ts

import { describe, it, expect, vi } from 'vitest';

import { InvalidPageCursorError, fetchPage, type PaginationOrder } from '@/lib/pagination';

type Row = { id: string; name: string; createdAt: Date };

const byName: PaginationOrder = {
  field: 'name',
  type: 'string',
  direction: 'asc',
  idDirection: 'asc',
};

const byDate: PaginationOrder = {
  field: 'createdAt',
  type: 'date',
  direction: 'desc',
  idDirection: 'desc',
};

function compareValues(left: unknown, right: unknown): number {
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

function matchesValue(actual: unknown, condition: unknown): boolean {
  if (condition instanceof Date) {
    return actual instanceof Date && actual.getTime() === condition.getTime();
  }
  if (typeof condition !== 'object' || condition === null) return actual === condition;
  return Object.entries(condition as Record<string, unknown>).every(([operator, expected]) => {
    if (operator === 'lt') return compareValues(actual, expected) < 0;
    if (operator === 'gt') return compareValues(actual, expected) > 0;
    return actual === expected;
  });
}

function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') {
      return (condition as Record<string, unknown>[]).every((nested) => matches(row, nested));
    }
    if (key === 'OR') {
      return (condition as Record<string, unknown>[]).some((nested) => matches(row, nested));
    }
    return matchesValue(row[key as keyof Row], condition);
  });
}

function findManyFor(rows: Row[]) {
  return vi.fn(
    async ({
      where,
      orderBy,
      take,
    }: {
      where: Record<string, unknown>;
      orderBy: Array<Record<string, 'asc' | 'desc'>>;
      take: number;
    }) => {
      let matched = rows.filter((row) => matches(row, where));
      matched = [...matched].sort((left, right) => {
        for (const order of orderBy) {
          const [field, direction] = Object.entries(order)[0]!;
          const cmp = compareValues(left[field as keyof Row], right[field as keyof Row]);
          if (cmp !== 0) return direction === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
      return matched.slice(0, take);
    },
  );
}

describe('fetchPage', () => {
  const rows: Row[] = [
    { id: 'a', name: 'Alpha', createdAt: new Date('2026-08-01T10:00:00.000Z') },
    { id: 'b', name: 'Beta', createdAt: new Date('2026-08-02T10:00:00.000Z') },
    { id: 'c', name: 'Gamma', createdAt: new Date('2026-08-03T10:00:00.000Z') },
  ];

  it('returns hasMore false and nextCursor null when remaining rows equal the page size', async () => {
    const findMany = findManyFor(rows.slice(0, 2));
    const page = await fetchPage({
      pageSize: 2,
      order: byName,
      findMany,
    });

    expect(page.items.map((row) => row.id)).toEqual(['a', 'b']);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('returns hasMore true and an opaque nextCursor when one extra row remains', async () => {
    const findMany = findManyFor(rows);
    const page = await fetchPage({
      pageSize: 2,
      order: byName,
      findMany,
    });

    expect(page.items.map((row) => row.id)).toEqual(['a', 'b']);
    expect(page.hasMore).toBe(true);
    expect(typeof page.nextCursor).toBe('string');
    expect(page.nextCursor).not.toMatch(/[{"]/);

    const rest = await fetchPage({
      pageSize: 2,
      order: byName,
      cursor: page.nextCursor,
      findMany,
    });
    expect(rest.items.map((row) => row.id)).toEqual(['c']);
    expect(rest.hasMore).toBe(false);
    expect(rest.nextCursor).toBeNull();
  });

  it('breaks ties on the sort key by id and does not skip or repeat a row', async () => {
    const tied: Row[] = [
      { id: 'm', name: 'Same', createdAt: new Date('2026-08-01T10:00:00.000Z') },
      { id: 'n', name: 'Same', createdAt: new Date('2026-08-01T10:00:00.000Z') },
      { id: 'o', name: 'Same', createdAt: new Date('2026-08-01T10:00:00.000Z') },
    ];
    const findMany = findManyFor(tied);
    const first = await fetchPage({ pageSize: 2, order: byName, findMany });
    const second = await fetchPage({
      pageSize: 2,
      order: byName,
      cursor: first.nextCursor,
      findMany,
    });

    const ids = [...first.items, ...second.items].map((row) => row.id);
    expect(ids).toEqual(['m', 'n', 'o']);
    expect(new Set(ids).size).toBe(3);
    expect(second.hasMore).toBe(false);
  });

  it('rejects a malformed cursor without fetching', async () => {
    const findMany = findManyFor(rows);
    await expect(
      fetchPage({ pageSize: 2, order: byName, cursor: 'not-a-cursor', findMany }),
    ).rejects.toBeInstanceOf(InvalidPageCursorError);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects a cursor bound to a different sort field without fetching', async () => {
    const findMany = findManyFor(rows);
    const datePage = await fetchPage({ pageSize: 2, order: byDate, findMany });
    findMany.mockClear();

    await expect(
      fetchPage({
        pageSize: 2,
        order: byName,
        cursor: datePage.nextCursor,
        findMany,
      }),
    ).rejects.toBeInstanceOf(InvalidPageCursorError);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects a cursor whose valid anchor was changed', async () => {
    const findMany = findManyFor(rows);
    const first = await fetchPage({ pageSize: 2, order: byName, findMany });
    const [body, signature] = first.nextCursor!.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      id: string;
    };
    const changed = `${Buffer.from(JSON.stringify({ ...payload, id: 'a' })).toString('base64url')}.${signature}`;
    findMany.mockClear();

    await expect(
      fetchPage({ pageSize: 2, order: byName, cursor: changed, findMany }),
    ).rejects.toBeInstanceOf(InvalidPageCursorError);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects a cursor after the signing secret changes', async () => {
    const findMany = findManyFor(rows);
    const first = await fetchPage({ pageSize: 2, order: byName, findMany });
    findMany.mockClear();

    vi.stubEnv('BETTER_AUTH_SECRET', 'another-test-secret-at-least-32-characters-long');
    try {
      await expect(
        fetchPage({ pageSize: 2, order: byName, cursor: first.nextCursor, findMany }),
      ).rejects.toBeInstanceOf(InvalidPageCursorError);
      expect(findMany).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
