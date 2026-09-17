import { z } from 'zod';

import { pageCursorSchema } from '@/lib/validation/pagination';
import { idSchema } from '@/lib/validation/id';

export type SortDirection = 'asc' | 'desc';

export type PaginationOrder = {
  field: string;
  type: 'string' | 'date';
  direction: SortDirection;
  idDirection: SortDirection;
};

export type PageCursor = string;

export type PageResult<T> = {
  items: T[];
  hasMore: boolean;
  nextCursor: PageCursor | null;
};

export class InvalidPageCursorError extends Error {
  constructor() {
    super('Invalid page cursor');
    this.name = 'InvalidPageCursorError';
  }
}

const cursorPayloadSchema = z.object({
  id: idSchema,
  value: z.string().max(10_000),
  field: z.string().min(1).max(128),
  direction: z.enum(['asc', 'desc']),
  idDirection: z.enum(['asc', 'desc']),
});

type CursorPayload = z.infer<typeof cursorPayloadSchema>;

async function encodePageCursor(payload: CursorPayload): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${await signCursor(body)}`;
}

async function signCursor(body: string): Promise<string> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required for page cursors');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Buffer.from(signature).toString('base64url');
}

async function decodePageCursor(raw: string, order: PaginationOrder): Promise<CursorPayload> {
  const bounded = pageCursorSchema.safeParse(raw);
  if (!bounded.success) throw new InvalidPageCursorError();

  const parts = bounded.data.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new InvalidPageCursorError();
  const [body, signature] = parts;
  const expected = await signCursor(body);
  if (signature.length !== expected.length) throw new InvalidPageCursorError();
  let difference = 0;
  for (let index = 0; index < signature.length; index += 1) {
    difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  if (difference !== 0) throw new InvalidPageCursorError();

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidPageCursorError();
  }

  const payload = cursorPayloadSchema.safeParse(json);
  if (!payload.success) throw new InvalidPageCursorError();
  if (
    payload.data.field !== order.field ||
    payload.data.direction !== order.direction ||
    payload.data.idDirection !== order.idDirection
  ) {
    throw new InvalidPageCursorError();
  }
  if (order.type === 'date' && Number.isNaN(new Date(payload.data.value).getTime())) {
    throw new InvalidPageCursorError();
  }
  return payload.data;
}

function decodedSortValue(payload: CursorPayload, order: PaginationOrder): Date | string {
  if (order.type === 'date') return new Date(payload.value);
  return payload.value;
}

function cursorWhere(payload: CursorPayload, order: PaginationOrder): Record<string, unknown> {
  const op = order.direction === 'desc' ? 'lt' : 'gt';
  const idOp = order.idDirection === 'desc' ? 'lt' : 'gt';
  const value = decodedSortValue(payload, order);
  return {
    OR: [
      { [order.field]: { [op]: value } },
      { AND: [{ [order.field]: value }, { id: { [idOp]: payload.id } }] },
    ],
  };
}

function mergeWhere(
  where: Record<string, unknown> | undefined,
  extra: Record<string, unknown> | null,
): Record<string, unknown> {
  const base = where ?? {};
  if (!extra) return base;
  if (Object.keys(base).length === 0) return extra;
  return { AND: [base, extra] };
}

function sortValueFromRow(row: Record<string, unknown>, order: PaginationOrder): string {
  const raw = row[order.field];
  if (order.type === 'date') {
    const date = raw instanceof Date ? raw : new Date(String(raw ?? ''));
    return date.toISOString();
  }
  return String(raw ?? '');
}

export async function fetchPage<T extends { id: string }>(input: {
  pageSize: number;
  order: PaginationOrder;
  cursor?: string | null;
  where?: Record<string, unknown>;
  findMany: (args: {
    where: Record<string, unknown>;
    orderBy: Array<Record<string, SortDirection>>;
    take: number;
  }) => Promise<T[]>;
}): Promise<PageResult<T>> {
  const decoded =
    input.cursor == null || input.cursor === ''
      ? null
      : await decodePageCursor(input.cursor, input.order);

  const rows = await input.findMany({
    where: mergeWhere(input.where, decoded ? cursorWhere(decoded, input.order) : null),
    orderBy: [{ [input.order.field]: input.order.direction }, { id: input.order.idDirection }],
    take: input.pageSize + 1,
  });

  const hasMore = rows.length > input.pageSize;
  const items = hasMore ? rows.slice(0, input.pageSize) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? await encodePageCursor({
          id: last.id,
          value: sortValueFromRow(last as Record<string, unknown>, input.order),
          field: input.order.field,
          direction: input.order.direction,
          idDirection: input.order.idDirection,
        })
      : null;

  return { items, hasMore, nextCursor };
}
