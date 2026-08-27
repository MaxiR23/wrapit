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
function isIncrement(value: unknown): value is { increment: number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    'increment' in value &&
    typeof (value as { increment: unknown }).increment === 'number'
  );
}

function applyUpdateData(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (isIncrement(value)) {
      const current = typeof row[key] === 'number' ? (row[key] as number) : 0;
      row[key] = current + value.increment;
    } else {
      row[key] = value;
    }
  }
}

function compareValues(left: unknown, right: unknown): number {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }
  if (left === right) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function matchesValue(actual: unknown, condition: unknown): boolean {
  if (condition === null) {
    return actual == null;
  }
  if (condition instanceof Date) {
    return actual instanceof Date && actual.getTime() === condition.getTime();
  }
  if (typeof condition !== 'object') {
    return actual === condition;
  }
  return Object.entries(condition as Row).every(([operator, expected]) => {
    switch (operator) {
      case 'equals':
        return matchesValue(actual, expected);
      case 'not':
        return !matchesValue(actual, expected);
      case 'in':
        return (expected as unknown[]).includes(actual);
      case 'lt':
        return compareValues(actual, expected) < 0;
      case 'gt':
        return compareValues(actual, expected) > 0;
      case 'lte':
        return compareValues(actual, expected) <= 0;
      case 'gte':
        return compareValues(actual, expected) >= 0;
      default:
        throw new Error(`unsupported where operator: ${operator}`);
    }
  });
}

const SCALAR_WHERE_OPS = new Set(['equals', 'not', 'in', 'lt', 'gt', 'lte', 'gte']);

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
  if (
    data.userId != null &&
    data.order != null &&
    rows.some((row) => row.userId === data.userId && row.order === data.order)
  ) {
    throw new Error('unique constraint');
  }
  if (
    data.projectId != null &&
    data.order != null &&
    data.tone != null &&
    rows.some((row) => row.projectId === data.projectId && row.order === data.order)
  ) {
    throw new Error('unique constraint');
  }
  if (
    data.cardId != null &&
    data.userId != null &&
    rows.some((row) => row.cardId === data.cardId && row.userId === data.userId)
  ) {
    throw new Error('unique constraint');
  }
  const withDefaults = { ...data };
  if (
    withDefaults.role != null &&
    withDefaults.userId != null &&
    withDefaults.projectId != null &&
    withDefaults.inviteeId == null &&
    withDefaults.access == null
  ) {
    withDefaults.access = 'EDIT';
  }
  if (
    withDefaults.title != null &&
    withDefaults.ownerId != null &&
    withDefaults.publicLinkEnabled == null
  ) {
    withDefaults.publicLinkEnabled = false;
  }
  const row = {
    id: typeof data.id === 'string' ? data.id : `fake-${rows.length + 1}`,
    createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
    ...withDefaults,
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
    createMany: vi.fn(
      async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const item of data) {
          const duplicate = rows.some(
            (row) =>
              (typeof item.id === 'string' && row.id === item.id) ||
              (item.projectId != null &&
                item.inviteeId != null &&
                row.projectId === item.projectId &&
                row.inviteeId === item.inviteeId) ||
              (item.userId != null &&
                item.order != null &&
                row.userId === item.userId &&
                row.order === item.order) ||
              (item.projectId != null &&
                item.order != null &&
                item.tone != null &&
                row.projectId === item.projectId &&
                row.order === item.order) ||
              (item.cardId != null &&
                item.userId != null &&
                row.cardId === item.cardId &&
                row.userId === item.userId),
          );
          if (duplicate) {
            if (skipDuplicates) continue;
            throw new Error('unique constraint');
          }
          createRow(rows, item);
          count += 1;
        }
        return { count };
      },
    ),
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

        const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        if (orders.length > 0) {
          matched = [...matched].sort((a, b) => {
            for (const order of orders) {
              if (!order || typeof order !== 'object') continue;
              const [[field, direction]] = Object.entries(order);
              const cmp = compareValues(a[field], b[field]);
              if (cmp !== 0) return direction === 'desc' ? -cmp : cmp;
            }
            return 0;
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
      applyUpdateData(row, data);
      return { ...row };
    }),
    updateMany: vi.fn(async ({ where, data }: { where?: Row; data: Row }) => {
      const matched = rows.filter((r) => matches(r, where, getRelated));
      for (const row of matched) applyUpdateData(row, data);
      return { count: matched.length };
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

type ModelDelegate = ReturnType<typeof createModel>;

function sqlFromRaw(strings: unknown, values: unknown[]): string {
  if (Array.isArray(strings)) {
    return strings
      .map((part, index) => `${part}${index < values.length ? String(values[index]) : ''}`)
      .join('');
  }
  return String(strings);
}

function wrapModelForTransaction(model: ModelDelegate, takeSnapshot: () => void): ModelDelegate {
  const wrapped = { ...model };
  for (const [key, value] of Object.entries(model)) {
    if (typeof value !== 'function') continue;
    (wrapped as unknown as Record<string, unknown>)[key] = vi.fn((...args: unknown[]) => {
      takeSnapshot();
      return (value as (...inner: unknown[]) => unknown)(...args);
    });
  }
  return wrapped;
}

export function createPrismaFake() {
  const models: Record<string, ModelDelegate> = {};
  const userRowLocks = new Map<string, Promise<void>>();
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
      case 'statuses':
        return (models.userStatus?.rows ?? []).filter((status) => status.userId === row.id);
      case 'labels':
        return (models.label?.rows ?? []).filter((label) => label.projectId === row.id);
      case 'label':
        return (models.label?.rows ?? []).filter((label) => label.id === row.labelId);
      case 'column':
        return (models.column?.rows ?? []).filter((column) => column.id === row.columnId);
      case 'assignees':
        return (models.cardAssignee?.rows ?? []).filter((assignee) => assignee.cardId === row.id);
      case 'subtasks':
        return (models.subtask?.rows ?? []).filter((subtask) => subtask.cardId === row.id);
      case 'comments':
        return (models.comment?.rows ?? []).filter((comment) => comment.cardId === row.id);
      case 'activityEvents':
        return (models.activityEvent?.rows ?? []).filter((event) => event.projectId === row.id);
      case 'actor':
        return (models.user?.rows ?? []).filter((user) => user.id === row.actorId);
      case 'restoreUndoTokens':
        return (models.restoreUndoToken?.rows ?? []).filter(
          (token) => token.projectId === row.id || token.userId === row.id,
        );
      default:
        return [];
    }
  };

  async function acquireUserRowLock(userId: string): Promise<() => void> {
    let unlockNext = () => {};
    const next = new Promise<void>((resolve) => {
      unlockNext = resolve;
    });
    const previous = userRowLocks.get(userId) ?? Promise.resolve();
    userRowLocks.set(
      userId,
      previous.then(() => next),
    );
    await previous;
    return unlockNext;
  }

  const fake = {
    user: createModel(getRelated),
    session: createModel(getRelated),
    account: createModel(getRelated),
    verification: createModel(getRelated),
    project: createModel(getRelated),
    column: createModel(getRelated),
    card: createModel(getRelated),
    membership: createModel(getRelated),
    invitation: createModel(getRelated),
    notification: createModel(getRelated),
    userPreferences: createModel(getRelated),
    userProfile: createModel(getRelated),
    userStatus: createModel(getRelated),
    label: createModel(getRelated),
    cardAssignee: createModel(getRelated),
    subtask: createModel(getRelated),
    comment: createModel(getRelated),
    recentProject: createModel(getRelated),
    activityEvent: createModel(getRelated),
    restoreUndoToken: createModel(getRelated),
  };
  Object.assign(models, fake);

  function cascadeCardChildren(cardIds: unknown[]) {
    const ids = new Set(cardIds);
    fake.cardAssignee.rows.splice(
      0,
      fake.cardAssignee.rows.length,
      ...fake.cardAssignee.rows.filter((row) => !ids.has(row.cardId)),
    );
    fake.subtask.rows.splice(
      0,
      fake.subtask.rows.length,
      ...fake.subtask.rows.filter((row) => !ids.has(row.cardId)),
    );
    fake.comment.rows.splice(
      0,
      fake.comment.rows.length,
      ...fake.comment.rows.filter((row) => !ids.has(row.cardId)),
    );
  }

  const originalCardDelete = fake.card.delete;
  fake.card.delete = vi.fn(async (args: { where?: Row }) => {
    const matched = fake.card.rows.find((row) => matches(row, args.where, getRelated));
    const deleted = await originalCardDelete(args);
    if (matched?.id != null) cascadeCardChildren([matched.id]);
    return deleted;
  });

  const originalCardDeleteMany = fake.card.deleteMany;
  fake.card.deleteMany = vi.fn(async (args: { where?: Row } = {}) => {
    const matched = fake.card.rows.filter((row) => matches(row, args.where, getRelated));
    const result = await originalCardDeleteMany(args);
    cascadeCardChildren(matched.map((row) => row.id));
    return result;
  });

  function nullifyActiveStatuses(deletedStatusIds: unknown[]) {
    const ids = new Set(deletedStatusIds);
    for (const user of fake.user.rows) {
      if (ids.has(user.activeStatusId)) {
        user.activeStatusId = null;
      }
    }
  }

  const originalStatusDelete = fake.userStatus.delete;
  fake.userStatus.delete = vi.fn(async (args: { where?: Row }) => {
    const matched = fake.userStatus.rows.find((row) => matches(row, args.where, getRelated));
    const deleted = await originalStatusDelete(args);
    if (matched?.id != null) nullifyActiveStatuses([matched.id]);
    return deleted;
  });

  const originalStatusDeleteMany = fake.userStatus.deleteMany;
  fake.userStatus.deleteMany = vi.fn(async (args: { where?: Row } = {}) => {
    const matched = fake.userStatus.rows.filter((row) => matches(row, args.where, getRelated));
    const result = await originalStatusDeleteMany(args);
    nullifyActiveStatuses(matched.map((row) => row.id));
    return result;
  });

  function cascadeProjectChildren(projectIds: unknown[]) {
    const ids = new Set(projectIds);
    fake.activityEvent.rows.splice(
      0,
      fake.activityEvent.rows.length,
      ...fake.activityEvent.rows.filter((row) => !ids.has(row.projectId)),
    );
    fake.restoreUndoToken.rows.splice(
      0,
      fake.restoreUndoToken.rows.length,
      ...fake.restoreUndoToken.rows.filter((row) => !ids.has(row.projectId)),
    );
  }

  const originalProjectDelete = fake.project.delete;
  fake.project.delete = vi.fn(async (args: { where?: Row }) => {
    const matched = fake.project.rows.find((row) => matches(row, args.where, getRelated));
    const deleted = await originalProjectDelete(args);
    if (matched?.id != null) cascadeProjectChildren([matched.id]);
    return deleted;
  });

  const originalProjectDeleteMany = fake.project.deleteMany;
  fake.project.deleteMany = vi.fn(async (args: { where?: Row } = {}) => {
    const matched = fake.project.rows.filter((row) => matches(row, args.where, getRelated));
    const result = await originalProjectDeleteMany(args);
    cascadeProjectChildren(matched.map((row) => row.id));
    return result;
  });

  function nullifyActivityActors(deletedUserIds: unknown[]) {
    const ids = new Set(deletedUserIds);
    for (const event of fake.activityEvent.rows) {
      if (ids.has(event.actorId)) {
        event.actorId = null;
      }
    }
    fake.restoreUndoToken.rows.splice(
      0,
      fake.restoreUndoToken.rows.length,
      ...fake.restoreUndoToken.rows.filter((row) => !ids.has(row.userId)),
    );
  }

  const originalUserDelete = fake.user.delete;
  fake.user.delete = vi.fn(async (args: { where?: Row }) => {
    const matched = fake.user.rows.find((row) => matches(row, args.where, getRelated));
    const deleted = await originalUserDelete(args);
    if (matched?.id != null) nullifyActivityActors([matched.id]);
    return deleted;
  });

  const originalUserDeleteMany = fake.user.deleteMany;
  fake.user.deleteMany = vi.fn(async (args: { where?: Row } = {}) => {
    const matched = fake.user.rows.filter((row) => matches(row, args.where, getRelated));
    const result = await originalUserDeleteMany(args);
    nullifyActivityActors(matched.map((row) => row.id));
    return result;
  });

  function queryRaw(unlocks: Array<() => void>) {
    return vi.fn(async (strings: unknown, ...values: unknown[]) => {
      const sql = sqlFromRaw(strings, values);
      if (/FOR UPDATE/i.test(sql)) {
        unlocks.push(await acquireUserRowLock(String(values[0] ?? '')));
      }
      return values[0] != null ? [{ id: values[0] }] : [];
    });
  }

  const client = {
    ...fake,
    $queryRaw: queryRaw([]),
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        const unlocks: Array<() => void> = [];
        const rollback: { rows: Record<string, Row[]> | null } = { rows: null };
        const takeSnapshot = () => {
          if (rollback.rows) return;
          const next: Record<string, Row[]> = {};
          for (const [name, model] of Object.entries(fake)) {
            next[name] = model.rows.map((row) => ({ ...row }));
          }
          rollback.rows = next;
        };
        const txModels: Record<string, ModelDelegate> = {};
        for (const [name, model] of Object.entries(fake)) {
          txModels[name] = wrapModelForTransaction(model, takeSnapshot);
        }
        const tx = { ...txModels, $queryRaw: queryRaw(unlocks) };
        try {
          return await arg(tx);
        } catch (error) {
          if (rollback.rows) {
            for (const [name, model] of Object.entries(fake)) {
              model.rows.length = 0;
              model.rows.push(...(rollback.rows[name] ?? []));
            }
          }
          throw error;
        } finally {
          for (const unlock of unlocks) unlock();
        }
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
    reset() {
      for (const model of Object.values(fake)) model.rows.length = 0;
      userRowLocks.clear();
    },
  };

  return client;
}
