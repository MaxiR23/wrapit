import { z } from 'zod';

import { dueDateFromCalendarDay, isValidTimeZone } from '@/lib/cardDue';
import { firstErrorPerField, type FieldErrors } from '@/lib/validation/fieldErrors';
import { idSchema } from '@/lib/validation/id';

export const DUE_DATE_MESSAGE = 'Enter a valid date';

export const DUE_TIME_MESSAGE = 'Enter a valid time';

export const DUE_TIME_ZONE_MESSAGE = 'Enter a valid time zone';

const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MAX_CARD_ASSIGNEES = 20;

export const cardSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
});

export type CardInput = z.infer<typeof cardSchema>;

function blankToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const optionalDueDateSchema = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(CALENDAR_DAY_PATTERN, DUE_DATE_MESSAGE)
    .refine((day) => dueDateFromCalendarDay(day) !== null, DUE_DATE_MESSAGE)
    .optional(),
);

const optionalDueTimeSchema = z.preprocess(
  blankToUndefined,
  z.string().regex(CLOCK_TIME_PATTERN, DUE_TIME_MESSAGE).optional(),
);

const optionalDueTimeZoneSchema = z.preprocess(
  blankToUndefined,
  z.string().refine(isValidTimeZone, DUE_TIME_ZONE_MESSAGE).optional(),
);

/**
 * A time only means something on a day, and only in a zone. A zone without a
 * time is meaningless too, since a calendar day carries no zone.
 */
function checkDuePairing(
  data: { dueDate?: string; dueTime?: string; dueTimeZone?: string },
  ctx: z.RefinementCtx,
  paths: { time: string; timeZone: string },
): void {
  if (data.dueTime !== undefined && data.dueDate === undefined) {
    ctx.addIssue({ code: 'custom', path: [paths.time], message: DUE_DATE_MESSAGE });
  }
  if (data.dueTime !== undefined && data.dueTimeZone === undefined) {
    ctx.addIssue({ code: 'custom', path: [paths.timeZone], message: DUE_TIME_ZONE_MESSAGE });
  }
  if (data.dueTimeZone !== undefined && data.dueTime === undefined) {
    ctx.addIssue({ code: 'custom', path: [paths.time], message: DUE_TIME_MESSAGE });
  }
}

export const createCardSchema = cardSchema
  .extend({
    columnId: idSchema,
    labelId: idSchema.optional(),
    dueDate: optionalDueDateSchema,
    dueTime: optionalDueTimeSchema,
    dueTimeZone: optionalDueTimeZoneSchema,
    assigneeIds: z.array(idSchema).max(MAX_CARD_ASSIGNEES).optional(),
  })
  .superRefine((data, ctx) => {
    checkDuePairing(data, ctx, { time: 'dueTime', timeZone: 'dueTimeZone' });
  });

export type CreateCardInput = z.infer<typeof createCardSchema>;

export type CardFieldErrors = FieldErrors<
  CardInput & { dueDate?: string; dueTime?: string; dueTimeZone?: string }
>;

export const updateCardSchema = cardSchema.extend({
  cardId: idSchema,
});

export const deleteCardSchema = z.object({
  cardId: idSchema,
});

export const archiveCardSchema = z.object({
  cardId: idSchema,
});

export const CARD_FIELDS = ['title', 'description', 'dueDate'] as const;

export const updateCardFieldSchema = z
  .object({
    cardId: idSchema,
    field: z.enum(CARD_FIELDS),
    value: z.string(),
    time: z.preprocess(blankToUndefined, z.string().optional()),
    timeZone: z.preprocess(blankToUndefined, z.string().optional()),
  })
  .superRefine((data, ctx) => {
    if (data.field === 'title') {
      const title = data.value.trim();
      if (title.length < 1) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Title is required' });
      }
    }

    // The due field autosaves as one value, so every due issue lands on it.
    const fail = (message: string) => {
      ctx.addIssue({ code: 'custom', path: ['value'], message });
    };

    if (data.field !== 'dueDate') {
      if (data.time !== undefined || data.timeZone !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['field'], message: DUE_TIME_MESSAGE });
      }
      return;
    }

    const day = data.value.trim();
    if (day !== '' && (!CALENDAR_DAY_PATTERN.test(day) || dueDateFromCalendarDay(day) === null)) {
      fail(DUE_DATE_MESSAGE);
      return;
    }
    if (data.time !== undefined && !CLOCK_TIME_PATTERN.test(data.time)) {
      fail(DUE_TIME_MESSAGE);
      return;
    }
    if (data.timeZone !== undefined && !isValidTimeZone(data.timeZone)) {
      fail(DUE_TIME_ZONE_MESSAGE);
      return;
    }
    if (data.time !== undefined && day === '') fail(DUE_DATE_MESSAGE);
    if (data.time !== undefined && data.timeZone === undefined) fail(DUE_TIME_ZONE_MESSAGE);
    if (data.timeZone !== undefined && data.time === undefined) fail(DUE_TIME_MESSAGE);
  });

export type UpdateCardFieldInput = z.infer<typeof updateCardFieldSchema>;
export type UpdateCardFieldErrors = FieldErrors<{ value: string }>;

export const updateCardAssigneesSchema = z.object({
  cardId: idSchema,
  assigneeIds: z.array(idSchema).max(MAX_CARD_ASSIGNEES),
});

export const updateCardLabelSchema = z.object({
  cardId: idSchema,
  labelId: idSchema.optional().nullable(),
});

/**
 * Validates the card fields and returns the first error for each invalid
 * field, ready to render next to its input. An empty object means valid input.
 */
export function validateCard(input: CardInput): CardFieldErrors {
  const result = cardSchema.safeParse(input);
  if (result.success) return {};

  return firstErrorPerField(result.error);
}
