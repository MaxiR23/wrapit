// tests/helpers/prismaFake.ts
//
// In-memory stand-in for the Prisma client, covering the delegate methods the
// Better Auth Prisma adapter uses. Anything it calls that is not implemented
// here throws, so a test can never silently reach the real database.
//
// SEE: src/lib/prisma.ts

import { vi } from 'vitest';

type Row = Record<string, unknown>;

// The adapter writes conditions as operator objects, e.g.
// { email: { equals: 'ada@example.com' } }.
function matchesValue(actual: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== 'object') {
    return actual === condition;
  }
  return Object.entries(condition as Row).every(([operator, expected]) => {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not':
        return actual !== expected;
      case 'in':
        return (expected as unknown[]).includes(actual);
      default:
        throw new Error(`unsupported where operator: ${operator}`);
    }
  });
}

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return (condition as Row[]).every((c) => matches(row, c));
    if (key === 'OR') return (condition as Row[]).some((c) => matches(row, c));
    return matchesValue(row[key], condition);
  });
}

function createModel() {
  const rows: Row[] = [];

  return {
    rows,
    create: vi.fn(async ({ data }: { data: Row }) => {
      const row = {
        id: typeof data.id === 'string' ? data.id : `fake-${rows.length + 1}`,
        createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
        ...data,
      };
      rows.push(row);
      return { ...row };
    }),
    findFirst: vi.fn(async ({ where }: { where?: Row } = {}) => {
      const row = rows.find((r) => matches(r, where));
      return row ? { ...row } : null;
    }),
    findMany: vi.fn(
      async ({
        where,
        skip = 0,
        take,
        orderBy,
      }: {
        where?: Row;
        skip?: number;
        take?: number;
        orderBy?: Row | Row[];
      } = {}) => {
        let matched = rows.filter((r) => matches(r, where));

        const order = Array.isArray(orderBy) ? orderBy[0] : orderBy;
        if (order && typeof order === 'object') {
          const [[field, direction]] = Object.entries(order);
          matched = [...matched].sort((a, b) => {
            const left = a[field];
            const right = b[field];
            if (left === right) return 0;
            if (left == null) return 1;
            if (right == null) return -1;
            const cmp = left < right ? -1 : 1;
            return direction === 'desc' ? -cmp : cmp;
          });
        }

        return matched
          .slice(skip, take === undefined ? undefined : skip + take)
          .map((r) => ({ ...r }));
      },
    ),
    update: vi.fn(async ({ where, data }: { where?: Row; data: Row }) => {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error('record not found');
      Object.assign(row, data);
      return { ...row };
    }),
    delete: vi.fn(async ({ where }: { where?: Row }) => {
      const index = rows.findIndex((r) => matches(r, where));
      if (index === -1) throw new Error('record not found');
      return { ...rows.splice(index, 1)[0] };
    }),
    deleteMany: vi.fn(async ({ where }: { where?: Row } = {}) => {
      const kept = rows.filter((r) => !matches(r, where));
      const count = rows.length - kept.length;
      rows.splice(0, rows.length, ...kept);
      return { count };
    }),
    count: vi.fn(
      async ({ where }: { where?: Row } = {}) => rows.filter((r) => matches(r, where)).length,
    ),
  };
}

export function createPrismaFake() {
  const fake = {
    user: createModel(),
    session: createModel(),
    account: createModel(),
    verification: createModel(),
    board: createModel(),
    column: createModel(),
  };

  return {
    ...fake,
    reset() {
      for (const model of Object.values(fake)) model.rows.length = 0;
    },
  };
}
