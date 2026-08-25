import { z } from 'zod';

import { idSchema } from '@/lib/validation/id';

export const ACTIVITY_EVENT_TYPES = [
  'CARD_CREATED',
  'CARD_MOVED',
  'CARD_ARCHIVED',
  'CARD_DELETED',
  'ASSIGNEES_CHANGED',
  'LABEL_CHANGED',
  'DUE_DATE_CHANGED',
  'COMMENT_ADDED',
  'MEMBER_ADDED',
  'MEMBER_REMOVED',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const ACTIVITY_PAGE_SIZE = 50;

const actorFields = {
  actorName: z.string().min(1),
  actorUsername: z.string(),
};

const assigneeSchema = z.object({
  id: idSchema,
  name: z.string(),
  username: z.string(),
});

export const activityPayloadSchemas = {
  CARD_CREATED: z.object({
    ...actorFields,
    cardId: idSchema,
    cardTitle: z.string(),
    columnId: idSchema,
    columnTitle: z.string(),
  }),
  CARD_MOVED: z.object({
    ...actorFields,
    cardId: idSchema,
    cardTitle: z.string(),
    fromColumnId: idSchema,
    fromColumnTitle: z.string(),
    toColumnId: idSchema,
    toColumnTitle: z.string(),
  }),
  CARD_ARCHIVED: z.object({
    ...actorFields,
    cardId: idSchema,
    cardTitle: z.string(),
  }),
  CARD_DELETED: z.object({
    ...actorFields,
    cardId: idSchema,
    cardTitle: z.string(),
  }),
  ASSIGNEES_CHANGED: z.object({
    ...actorFields,
    cardId: idSchema,
    cardTitle: z.string(),
    assignees: z.array(assigneeSchema),
  }),
  LABEL_CHANGED: z.object({
    ...actorFields,
    cardId: idSchema,
    cardTitle: z.string(),
    labelId: idSchema.nullable(),
    labelName: z.string().nullable(),
  }),
  DUE_DATE_CHANGED: z.object({
    ...actorFields,
    cardId: idSchema,
    cardTitle: z.string(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  }),
  COMMENT_ADDED: z.object({
    ...actorFields,
    cardId: idSchema,
    cardTitle: z.string(),
    commentId: idSchema,
    body: z.string().min(1).max(4000),
  }),
  MEMBER_ADDED: z.object({
    ...actorFields,
    memberId: idSchema,
    memberName: z.string().min(1),
    memberUsername: z.string(),
    inviterId: idSchema,
    inviterName: z.string().min(1),
    inviterUsername: z.string(),
  }),
  MEMBER_REMOVED: z.object({
    ...actorFields,
    memberId: idSchema,
    memberName: z.string().min(1),
    memberUsername: z.string(),
  }),
} as const;

export type ActivityPayloadFor<T extends ActivityEventType> = z.infer<
  (typeof activityPayloadSchemas)[T]
>;

export type ActivityPayload = {
  [T in ActivityEventType]: ActivityPayloadFor<T>;
}[ActivityEventType];

export type ActivityTx = {
  activityEvent: {
    create: (args: {
      data: {
        type: ActivityEventType;
        payload: ActivityPayload;
        projectId: string;
        actorId: string | null;
      };
    }) => Promise<unknown>;
  };
};

export type ActivityListDb = {
  activityEvent: {
    findMany: (args: {
      where: Record<string, unknown>;
      orderBy?: Array<Record<string, string>> | Record<string, string>;
      take?: number;
    }) => Promise<Array<Record<string, unknown>>>;
  };
};

export type ActivityCursor = {
  createdAt: string;
  id: string;
};

export type ActivityEventListItem = {
  id: string;
  type: ActivityEventType;
  actorId: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
  valid: boolean;
};

const TYPE_SET = new Set<string>(ACTIVITY_EVENT_TYPES);

export function isActivityEventType(value: unknown): value is ActivityEventType {
  return typeof value === 'string' && TYPE_SET.has(value);
}

export function activityActorFromSession(user: { name: string; username?: unknown }): {
  actorName: string;
  actorUsername: string;
} {
  return {
    actorName: user.name,
    actorUsername: typeof user.username === 'string' ? user.username : '',
  };
}

export function parseActivityPayload(
  type: ActivityEventType,
  json: unknown,
  options: { strict?: boolean } = {},
): { success: true; data: ActivityPayload } | { success: false } {
  const schema = activityPayloadSchemas[type];
  const result = options.strict === true ? schema.strict().safeParse(json) : schema.safeParse(json);
  if (!result.success) return { success: false };
  return { success: true, data: result.data as ActivityPayload };
}

export async function recordActivityEvent<T extends ActivityEventType>(
  tx: ActivityTx,
  input: {
    projectId: string;
    actorId: string;
    type: T;
    payload: ActivityPayloadFor<T>;
  },
): Promise<void> {
  const parsed = activityPayloadSchemas[input.type].strict().parse(input.payload);
  await tx.activityEvent.create({
    data: {
      type: input.type,
      payload: parsed as ActivityPayload,
      projectId: input.projectId,
      actorId: input.actorId,
    },
  });
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(0);
}

function actorSnapshotFromUnknown(payload: unknown): {
  actorName: string;
  actorUsername: string;
} {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { actorName: 'Someone', actorUsername: '' };
  }
  const record = payload as Record<string, unknown>;
  return {
    actorName:
      typeof record.actorName === 'string' && record.actorName ? record.actorName : 'Someone',
    actorUsername: typeof record.actorUsername === 'string' ? record.actorUsername : '',
  };
}

export function activityEventFromRow(row: Record<string, unknown>): ActivityEventListItem {
  const type = isActivityEventType(row.type) ? row.type : 'CARD_CREATED';
  const parsed = isActivityEventType(row.type)
    ? parseActivityPayload(row.type, row.payload)
    : { success: false as const };
  const createdAt = asDate(row.createdAt).toISOString();
  if (parsed.success) {
    return {
      id: String(row.id),
      type,
      actorId: row.actorId == null ? null : String(row.actorId),
      createdAt,
      payload: parsed.data as unknown as Record<string, unknown>,
      valid: true,
    };
  }
  return {
    id: String(row.id),
    type,
    actorId: row.actorId == null ? null : String(row.actorId),
    createdAt,
    payload: actorSnapshotFromUnknown(row.payload),
    valid: false,
  };
}

export async function listActivityForProject(
  db: ActivityListDb,
  projectId: string,
  cursor?: ActivityCursor | null,
): Promise<{ items: ActivityEventListItem[]; nextCursor: ActivityCursor | null }> {
  const where: Record<string, unknown> = cursor
    ? {
        projectId,
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          {
            AND: [{ createdAt: new Date(cursor.createdAt) }, { id: { lt: cursor.id } }],
          },
        ],
      }
    : { projectId };

  const rows = await db.activityEvent.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: ACTIVITY_PAGE_SIZE + 1,
  });
  const page = rows.slice(0, ACTIVITY_PAGE_SIZE);
  const items = page.map((row) => activityEventFromRow(row));
  const last = items[items.length - 1];
  const nextCursor =
    rows.length > ACTIVITY_PAGE_SIZE && last ? { createdAt: last.createdAt, id: last.id } : null;
  return { items, nextCursor };
}
