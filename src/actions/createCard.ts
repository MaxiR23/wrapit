'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { cardCode } from '@/lib/cardCode';
import { dueDateFromCalendarDay, instantFromZonedWallTime } from '@/lib/cardDue';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { getColumnForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { MY_TASKS_PATH, projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { createCardSchema, type CardFieldErrors } from '@/lib/validation/card';

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

export type CreatedCardAssignee = {
  id: string;
  name: string;
  username: string;
};

type CreateCardResult =
  | {
      data: {
        id: string;
        title: string;
        description: string | null;
        code: string;
        order: number;
        columnId: string;
        dueDate: Date | null;
        dueTimeZone: string | null;
        labelId: string | null;
        assignees: CreatedCardAssignee[];
        comments: [];
        subtasks: [];
      };
    }
  | { fieldErrors: CardFieldErrors }
  | { error: string };

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export async function createCard(input: {
  columnId: string;
  title: string;
  description?: string;
  labelId?: string;
  dueDate?: string;
  dueTime?: string;
  dueTimeZone?: string;
  assigneeIds?: string[];
}): Promise<CreateCardResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) {
    const fieldFailed = parsed.error.issues.some((issue) => {
      const field = issue.path[0];
      return (
        field === 'title' ||
        field === 'description' ||
        field === 'dueDate' ||
        field === 'dueTime' ||
        field === 'dueTimeZone'
      );
    });
    if (fieldFailed) {
      return { fieldErrors: firstErrorPerField(parsed.error) as CardFieldErrors };
    }
    return { error: 'Unauthorized' };
  }

  // A time only arrives with a zone; the schema rejects one without the other.
  const dueTimeZone =
    parsed.data.dueTime !== undefined ? (parsed.data.dueTimeZone as string) : null;
  let dueDate: Date | null = null;
  if (parsed.data.dueDate !== undefined) {
    dueDate =
      dueTimeZone == null
        ? dueDateFromCalendarDay(parsed.data.dueDate)
        : instantFromZonedWallTime(parsed.data.dueDate, parsed.data.dueTime as string, dueTimeZone);
    if (dueDate === null) {
      return { fieldErrors: { dueDate: 'Enter a valid date' } };
    }
  }

  const owned = await getColumnForUser(parsed.data.columnId, session.user.id, 'EDIT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  const assigneeIds = uniqueIds(
    parsed.data.assigneeIds && parsed.data.assigneeIds.length > 0
      ? parsed.data.assigneeIds
      : [session.user.id],
  );

  try {
    const card = await prisma.$transaction(async (tx) => {
      if (parsed.data.labelId) {
        const labelCount = await tx.label.count({
          where: { id: parsed.data.labelId, projectId: owned.project.id },
        });
        if (labelCount !== 1) {
          throw new UnauthorizedWriteError();
        }
      }

      const memberCount = await tx.membership.count({
        where: { projectId: owned.project.id, userId: { in: assigneeIds } },
      });
      if (memberCount !== assigneeIds.length) {
        throw new UnauthorizedWriteError();
      }

      const project = await tx.project.update({
        where: { id: owned.project.id },
        data: { cardCounter: { increment: 1 } },
        select: { cardCounter: true, title: true },
      });
      const [last] = await tx.card.findMany({
        where: { columnId: owned.column.id },
        orderBy: { order: 'desc' },
        take: 1,
      });
      const order = (last?.order ?? 0) + 1;
      const description = parsed.data.description ? parsed.data.description : null;
      const code = cardCode(project.title, project.cardCounter);

      const created = await tx.card.create({
        data: {
          title: parsed.data.title,
          description,
          code,
          order,
          columnId: owned.column.id,
          dueDate,
          dueTimeZone,
          labelId: parsed.data.labelId ?? null,
        },
      });

      await tx.cardAssignee.createMany({
        data: assigneeIds.map((userId) => ({ cardId: created.id, userId })),
      });

      await recordActivityEvent(tx, {
        projectId: owned.project.id,
        actorId: session.user.id,
        type: 'CARD_CREATED',
        payload: {
          ...activityActorFromSession(session.user),
          cardId: created.id,
          cardTitle: created.title,
          columnId: owned.column.id,
          columnTitle: owned.column.title,
        },
      });

      return created;
    });

    const users = await prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true, username: true },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const assignees = assigneeIds.map((userId) => {
      const user = usersById.get(userId);
      if (user) {
        return { id: user.id, name: user.name, username: user.username };
      }
      if (userId === session.user.id) {
        return {
          id: userId,
          name: session.user.name,
          username: sessionUsername(session.user),
        };
      }
      return { id: userId, name: '', username: '' };
    });

    revalidatePath(projectPath(owned.project.id));
    revalidatePath(MY_TASKS_PATH);

    return {
      data: {
        id: card.id,
        title: card.title,
        description: card.description,
        code: card.code,
        order: card.order,
        columnId: card.columnId,
        dueDate: card.dueDate,
        dueTimeZone: card.dueTimeZone,
        labelId: card.labelId,
        assignees,
        comments: [],
        subtasks: [],
      },
    };
  } catch (error) {
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
