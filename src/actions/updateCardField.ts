'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { calendarDayFromDueDate, dueDateFromCalendarDay } from '@/lib/cardDue';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { updateCardFieldSchema, type UpdateCardFieldErrors } from '@/lib/validation/card';

type UpdateCardFieldResult =
  { data: { value: string } } | { fieldErrors: UpdateCardFieldErrors } | { error: string };

export async function updateCardField(input: {
  cardId: string;
  field: string;
  value: string;
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

  const { cardId, field, value } = parsed.data;

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

    const trimmed = value.trim();
    const dueDate = trimmed === '' ? null : dueDateFromCalendarDay(trimmed);
    if (trimmed !== '' && dueDate === null) {
      return { fieldErrors: { value: 'Enter a valid date' } };
    }
    const updated = await prisma.card.updateMany({
      where: { id: cardId },
      data: { dueDate },
    });
    if (updated.count !== 1) {
      return { error: 'Unauthorized' };
    }
    revalidatePath(projectPath(owned.project.id));
    return { data: { value: dueDate ? calendarDayFromDueDate(dueDate) : '' } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
