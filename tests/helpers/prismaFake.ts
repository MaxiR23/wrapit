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

const SCALAR_WHERE_OPS = new Set(['equals', 'not', 'in']);

function isCompoundUniqueWhere(key: string, condition: unknown): condition is Row {
  return (
    key.includes('_') &&
    condition !== null &&
    typeof condition === 'object' &&
    !Array.isArray(condition)
  );
}

function isRelationCondition(condition: unknown): condition is Row {
  if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
    return false;
  }
  const keys = Object.keys(condition);
  if (keys.length === 0) return false;
  if (keys.some((key) => key === 'some' || key === 'none' || key === 'every')) return true;
  return keys.every((key) => !SCALAR_WHERE_OPS.has(key));
}

function matches(
  row: Row,
  where: Row | undefined,
  getRelated: (field: string, row: Row) => Row[] = () => [],
): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') {
      return (condition as Row[]).every((nested) => matches(row, nested, getRelated));
    }
    if (key === 'OR') {
      return (condition as Row[]).some((nested) => matches(row, nested, getRelated));
    }
    // Prisma compound unique: { userId_projectId: { userId, projectId } }
    if (isCompoundUniqueWhere(key, condition)) return matches(row, condition, getRelated);
    if (isRelationCondition(condition)) {
      const related = getRelated(key, row);
      if ('some' in condition) {
        return related.some((item) => matches(item, condition.some as Row, getRelated));
      }
      if ('none' in condition) {
        return related.every((item) => !matches(item, condition.none as Row, getRelated));
      }
      if ('every' in condition) {
        return (
          related.length > 0 &&
          related.every((item) => matches(item, condition.every as Row, getRelated))
        );
      }
      return related.some((item) => matches(item, condition, getRelated));
    }
    return matchesValue(row[key], condition);
  });
}

function createRow(rows: Row[], data: Row) {
  const row = {
    id: typeof data.id === 'string' ? data.id : `fake-${rows.length + 1}`,
    createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
    ...data,
  };
  rows.push(row);
  return { ...row };
}

function findRow(
  rows: Row[],
  where?: Row,
  getRelated: (field: string, row: Row) => Row[] = () => [],
) {
  const row = rows.find((r) => matches(r, where, getRelated));
  return row ? { ...row } : null;
}

function createModel(getRelated: (field: string, row: Row) => Row[] = () => []) {
  const rows: Row[] = [];

  return {
    rows,
    create: vi.fn(async ({ data }: { data: Row }) => createRow(rows, data)),
    findFirst: vi.fn(async ({ where }: { where?: Row } = {}) => findRow(rows, where, getRelated)),
    findUnique: vi.fn(async ({ where }: { where?: Row } = {}) => findRow(rows, where, getRelated)),
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
        let matched = rows.filter((r) => matches(r, where, getRelated));

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
      const row = rows.find((r) => matches(r, where, getRelated));
      if (!row) throw new Error('record not found');
      Object.assign(row, data);
      return { ...row };
    }),
    delete: vi.fn(async ({ where }: { where?: Row }) => {
      const index = rows.findIndex((r) => matches(r, where, getRelated));
      if (index === -1) throw new Error('record not found');
      return { ...rows.splice(index, 1)[0] };
    }),
    deleteMany: vi.fn(async ({ where }: { where?: Row } = {}) => {
      const kept = rows.filter((r) => !matches(r, where, getRelated));
      const count = rows.length - kept.length;
      rows.splice(0, rows.length, ...kept);
      return { count };
    }),
    count: vi.fn(
      async ({ where }: { where?: Row } = {}) =>
        rows.filter((r) => matches(r, where, getRelated)).length,
    ),
    upsert: vi.fn(async ({ where, create, update }: { where?: Row; create: Row; update: Row }) => {
      const row = rows.find((r) => matches(r, where, getRelated));
      if (row) {
        Object.assign(row, update);
        return { ...row };
      }
      return createRow(rows, create);
    }),
  };
}

export function createPrismaFake() {
  const models: Record<string, ReturnType<typeof createModel>> = {};
  const getRelated = (field: string, row: Row): Row[] => {
    switch (field) {
      case 'project':
        return (models.project?.rows ?? []).filter((project) => project.id === row.projectId);
      case 'memberships':
        return (models.membership?.rows ?? []).filter(
          (membership) => membership.projectId === row.id,
        );
      case 'owner':
        return (models.user?.rows ?? []).filter((user) => user.id === row.ownerId);
      default:
        return [];
    }
  };

  const fake = {
    user: createModel(getRelated),
    session: createModel(getRelated),
    account: createModel(getRelated),
    verification: createModel(getRelated),
    project: createModel(getRelated),
    column: createModel(getRelated),
    card: createModel(getRelated),
    membership: createModel(getRelated),
    userPreferences: createModel(getRelated),
    recentProject: createModel(getRelated),
  };
  Object.assign(models, fake);

  const client = {
    ...fake,
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        const snapshot = Object.fromEntries(
          Object.entries(fake).map(([name, model]) => [
            name,
            model.rows.map((row) => ({ ...row })),
          ]),
        );
        try {
          return await arg(client);
        } catch (error) {
          for (const [name, model] of Object.entries(fake)) {
            model.rows.length = 0;
            model.rows.push(...(snapshot[name] ?? []));
          }
          throw error;
        }
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
    reset() {
      for (const model of Object.values(fake)) model.rows.length = 0;
    },
  };

  return client;
}
