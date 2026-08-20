export const USER_STATUS_TONES = ['green', 'gray', 'red', 'amber', 'blue', 'violet'] as const;

export type UserStatusTone = (typeof USER_STATUS_TONES)[number];

export const MAX_USER_STATUSES = 20;

export const DEFAULT_CUSTOM_STATUS_DESCRIPTION = 'Custom status';

export const MAX_USER_STATUSES_MESSAGE = 'You can have at most 20 statuses';

export const DEFAULT_USER_STATUSES = [
  { name: 'Active', description: 'Available for the team', color: 'green', order: 0 },
  { name: 'Inactive', description: 'No recent activity', color: 'gray', order: 1 },
  { name: 'Do not disturb', description: 'Notifications paused', color: 'red', order: 2 },
  { name: 'Out of office', description: 'Back on Monday', color: 'amber', order: 3 },
] as const satisfies ReadonlyArray<{
  name: string;
  description: string;
  color: UserStatusTone;
  order: number;
}>;

export type UserStatusView = {
  id: string;
  name: string;
  description: string;
  color: UserStatusTone;
  order: number;
};

export type UserStatusesView = {
  statuses: UserStatusView[];
  activeStatusId: string;
};

const TONE_CLASSES: Record<
  UserStatusTone,
  { text: string; pill: string; swatch: string; dot: string }
> = {
  green: {
    text: 'text-user-status-green',
    pill: 'text-user-status-green bg-user-status-green/14 border-user-status-green/32',
    swatch: 'bg-user-status-green/30 border-user-status-green',
    dot: 'bg-user-status-green',
  },
  gray: {
    text: 'text-user-status-gray',
    pill: 'text-user-status-gray bg-user-status-gray/14 border-user-status-gray/32',
    swatch: 'bg-user-status-gray/30 border-user-status-gray',
    dot: 'bg-user-status-gray',
  },
  red: {
    text: 'text-user-status-red',
    pill: 'text-user-status-red bg-user-status-red/14 border-user-status-red/32',
    swatch: 'bg-user-status-red/30 border-user-status-red',
    dot: 'bg-user-status-red',
  },
  amber: {
    text: 'text-user-status-amber',
    pill: 'text-user-status-amber bg-user-status-amber/14 border-user-status-amber/32',
    swatch: 'bg-user-status-amber/30 border-user-status-amber',
    dot: 'bg-user-status-amber',
  },
  blue: {
    text: 'text-user-status-blue',
    pill: 'text-user-status-blue bg-user-status-blue/14 border-user-status-blue/32',
    swatch: 'bg-user-status-blue/30 border-user-status-blue',
    dot: 'bg-user-status-blue',
  },
  violet: {
    text: 'text-user-status-violet',
    pill: 'text-user-status-violet bg-user-status-violet/14 border-user-status-violet/32',
    swatch: 'bg-user-status-violet/30 border-user-status-violet',
    dot: 'bg-user-status-violet',
  },
};

type StatusRow = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  color?: unknown;
  order?: unknown;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Maps a stored color to a palette key. Unknown → green. */
export function parseUserStatusTone(value: unknown): UserStatusTone {
  if (typeof value === 'string' && (USER_STATUS_TONES as readonly string[]).includes(value)) {
    return value as UserStatusTone;
  }
  return USER_STATUS_TONES[0];
}

export function nextUserStatusTone(current: UserStatusTone): UserStatusTone {
  const index = USER_STATUS_TONES.indexOf(current);
  const from = index < 0 ? 0 : index + 1;
  return USER_STATUS_TONES[from % USER_STATUS_TONES.length]!;
}

export function userStatusToneForIndex(index: number): UserStatusTone {
  const length = USER_STATUS_TONES.length;
  const normalized = ((index % length) + length) % length;
  return USER_STATUS_TONES[normalized]!;
}

export function userStatusToneClasses(tone: UserStatusTone): (typeof TONE_CLASSES)[UserStatusTone] {
  return TONE_CLASSES[parseUserStatusTone(tone)];
}

export function statusFromRow(row: StatusRow): UserStatusView {
  return {
    id: asString(row.id),
    name: asString(row.name),
    description: asString(row.description),
    color: parseUserStatusTone(row.color),
    order: typeof row.order === 'number' ? row.order : Number(row.order) || 0,
  };
}

export class LastStatusError extends Error {
  constructor() {
    super('Cannot delete the last status');
    this.name = 'LastStatusError';
  }
}

export class MaxStatusesError extends Error {
  constructor() {
    super(MAX_USER_STATUSES_MESSAGE);
    this.name = 'MaxStatusesError';
  }
}

type UserRowLockTx = {
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

/**
 * Serialize mutations for one user. Call at the start of a delete transaction
 * so two overlapping deletes cannot each pass the last-status count against
 * the other's still-uncommitted row (READ COMMITTED). Do not use a
 * pre-delete count instead: that reintroduces the read-then-write race
 * fixed in the invitations slice.
 */
export async function lockUserRow(tx: UserRowLockTx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

/**
 * Throws when the user has no remaining statuses. Call AFTER a conditional
 * deleteMany in the same transaction, and only after lockUserRow, so the
 * count sees a stable per-user view.
 */
export async function assertNotLastStatus(
  db: { userStatus: { count: (args: { where: Record<string, unknown> }) => Promise<number> } },
  userId: string,
): Promise<void> {
  const remaining = await db.userStatus.count({ where: { userId } });
  if (remaining === 0) {
    throw new LastStatusError();
  }
}
