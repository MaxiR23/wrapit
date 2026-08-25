'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import {
  calendarDayFromDueDate,
  dueDateFromCalendarDay,
  instantFromZonedWallTime,
  zonedWallTime,
} from '@/lib/cardDue';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import {
  DUE_DATE_MESSAGE,
  updateCardFieldSchema,
  type UpdateCardFieldErrors,
} from '@/lib/validation/card';

type UpdateCardFieldResult =
  | { data: { value: string; dueDate?: Date | null; dueTimeZone?: string | null } }
  | { fieldErrors: UpdateCardFieldErrors }
  | { error: string };

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

/**
 * A due date is unchanged when it names the same instant and is still the same
 * kind. The zone is left out on purpose: it only ever moves with the instant.
 */
function sameDue(
  stored: Date | null,
  storedZone: string | null,
  next: Date | null,
  nextZone: string | null,
): boolean {
  if (stored == null && next == null) return true;
  if (stored == null || next == null) return false;
  if (stored.getTime() !== next.getTime()) return false;
  return (storedZone == null) === (nextZone == null);
}

function duePayload(dueDate: Date | null, dueTimeZone: string | null) {
  if (dueDate == null) return { dueDate: null, dueTime: null, dueTimeZone: null };
  if (dueTimeZone == null) {
    return { dueDate: calendarDayFromDueDate(dueDate), dueTime: null, dueTimeZone: null };
  }
  const wall = zonedWallTime(dueDate, dueTimeZone);
  return { dueDate: wall.day, dueTime: wall.time, dueTimeZone };
}

export async function updateCardField(input: {
  cardId: string;
  field: string;
  value: string;
  time?: string;
  timeZone?: string;
}): Promise<UpdateCardFieldResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateCardFieldSchema.safeParse(input);
  if (!parsed.success) {
    const fieldFailed = parsed.error.issues.some(
      (issue) => issue.path[0] === 'value' || issue.path[0] === 'field',
    );
    if (fieldFailed) {
      return { fieldErrors: firstErrorPerField(parsed.error) as UpdateCardFieldErrors };
    }
    return { error: 'Unauthorized' };
  }

  const { cardId, field, value, time, timeZone } = parsed.data;

  const owned = await getCardForUser(cardId, session.user.id, 'EDIT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    if (field === 'title') {
      const title = value.trim();
      const updated = await prisma.card.updateMany({
        where: { id: cardId },
        data: { title },
      });
      if (updated.count !== 1) {
        return { error: 'Unauthorized' };
      }
      revalidatePath(projectPath(owned.project.id));
      return { data: { value: title } };
    }

    if (field === 'description') {
      const description = value.trim() === '' ? null : value.trim();
      const updated = await prisma.card.updateMany({
        where: { id: cardId },
        data: { description },
      });
      if (updated.count !== 1) {
        return { error: 'Unauthorized' };
      }
      revalidatePath(projectPath(owned.project.id));
      return { data: { value: description ?? '' } };
    }

    const day = value.trim();
    const senderZone = time !== undefined && timeZone !== undefined ? timeZone : null;
    let dueDate: Date | null = null;
    if (day !== '') {
      dueDate =
        senderZone == null
          ? dueDateFromCalendarDay(day)
          : instantFromZonedWallTime(day, time as string, senderZone);
      if (dueDate === null) {
        return { fieldErrors: { value: DUE_DATE_MESSAGE } };
      }
    }

    // The stored zone is the provenance of the moment, so it survives any save
    // that resolves to the same instant. Only a new moment re-stamps the zone.
    const stored = owned.card;
    const keepStoredZone =
      dueDate != null &&
      senderZone != null &&
      stored.dueDate != null &&
      stored.dueTimeZone != null &&
      dueDate.getTime() === stored.dueDate.getTime();
    const dueTimeZone = keepStoredZone ? stored.dueTimeZone : senderZone;

    const dueUnchanged = sameDue(stored.dueDate, stored.dueTimeZone, dueDate, dueTimeZone);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.card.updateMany({
        where: { id: cardId },
        data: { dueDate, dueTimeZone },
      });
      if (updated.count !== 1) {
        throw new UnauthorizedWriteError();
      }
      if (dueUnchanged) return;
      await recordActivityEvent(tx, {
        projectId: owned.project.id,
        actorId: session.user.id,
        type: 'DUE_DATE_CHANGED',
        payload: {
          ...activityActorFromSession(session.user),
          cardId: owned.card.id,
          cardTitle: owned.card.title,
          ...duePayload(dueDate, dueTimeZone),
        },
      });
    });
    revalidatePath(projectPath(owned.project.id));

    // The control reads in the sender's zone, so echo the value back in it.
    const wall = dueDate != null && senderZone != null ? zonedWallTime(dueDate, senderZone) : null;
    const echoed =
      dueDate == null ? '' : wall ? `${wall.day}T${wall.time}` : calendarDayFromDueDate(dueDate);
    return { data: { value: echoed, dueDate, dueTimeZone } };
  } catch (error) {
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
