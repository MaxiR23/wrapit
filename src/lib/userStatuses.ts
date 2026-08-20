import { prisma } from '@/lib/prisma';
import { DEFAULT_USER_STATUSES, statusFromRow, type UserStatusesView } from '@/lib/userStatus';

type StatusRow = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  color?: unknown;
  order?: unknown;
};

type UserStatusDb = {
  userStatus: {
    findMany: (args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, string>;
    }) => Promise<StatusRow[]>;
    createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>;
  };
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<{ activeStatusId?: unknown } | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  $transaction: <T>(fn: (tx: UserStatusDb) => Promise<T>) => Promise<T>;
};

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === 'P2002') return true;
  if ('message' in error && String(error.message).toLowerCase().includes('unique')) return true;
  return false;
}

async function ensureActiveStatus(
  tx: UserStatusDb,
  userId: string,
  statuses: UserStatusesView['statuses'],
  activeStatusId: unknown,
): Promise<UserStatusesView> {
  const known =
    typeof activeStatusId === 'string' && statuses.some((status) => status.id === activeStatusId);
  const nextId = known ? activeStatusId : statuses[0]!.id;
  if (nextId !== activeStatusId) {
    await tx.user.update({ where: { id: userId }, data: { activeStatusId: nextId } });
  }
  return { statuses, activeStatusId: nextId };
}

async function loadExisting(tx: UserStatusDb, userId: string): Promise<UserStatusesView | null> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const rows = await tx.userStatus.findMany({
    where: { userId },
    orderBy: { order: 'asc' },
  });
  if (rows.length === 0) return null;

  return ensureActiveStatus(tx, userId, rows.map(statusFromRow), user.activeStatusId);
}

async function loadOrSeed(tx: UserStatusDb, userId: string): Promise<UserStatusesView> {
  const existing = await loadExisting(tx, userId);
  if (existing) return existing;

  await tx.userStatus.createMany({
    data: DEFAULT_USER_STATUSES.map((status) => ({ ...status, userId })),
  });

  const created = await tx.userStatus.findMany({
    where: { userId },
    orderBy: { order: 'asc' },
  });
  const views = created.map(statusFromRow);
  const firstId = views[0]!.id;
  await tx.user.update({ where: { id: userId }, data: { activeStatusId: firstId } });
  return { statuses: views, activeStatusId: firstId };
}

/** Stored statuses for the user, seeding the four defaults when none exist yet. */
export async function getUserStatusesForUser(userId: string): Promise<UserStatusesView | null> {
  const db = prisma as unknown as UserStatusDb;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  try {
    return await db.$transaction((tx) => loadOrSeed(tx, userId));
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return db.$transaction((tx) => loadExisting(tx, userId));
  }
}
