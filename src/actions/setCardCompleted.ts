'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import {
  GENERIC_ERROR_MESSAGE,
  NO_DONE_COLUMN_MESSAGE,
  NO_OPEN_COLUMN_MESSAGE,
} from '@/lib/messages';
import { getCardForUser } from '@/lib/ownership';
import { prisma } from '@/lib/prisma';
import { doneColumnFrom, inboxColumnFrom } from '@/lib/projectGrid';
import { MY_TASKS_PATH, projectPath } from '@/lib/routes';
import { completeCardSchema } from '@/lib/validation/completeCard';

type SetCardCompletedResult =
  | {
      data: {
        id: string;
        title: string;
        description: string | null;
        code: string;
        order: number;
        columnId: string;
        completed: boolean;
      };
    }
  | { error: string };

class OccupancyError extends Error {
  constructor() {
    super('Card occupancy conflict');
    this.name = 'OccupancyError';
  }
}

class NoDoneColumnError extends Error {
  constructor() {
    super(NO_DONE_COLUMN_MESSAGE);
    this.name = 'NoDoneColumnError';
  }
}

class NoOpenColumnError extends Error {
  constructor() {
    super(NO_OPEN_COLUMN_MESSAGE);
    this.name = 'NoOpenColumnError';
  }
}

export async function setCardCompleted(input: {
  cardId: string;
  completed: boolean;
}): Promise<SetCardCompletedResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = completeCardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const owned = await getCardForUser(parsed.data.cardId, session.user.id, 'EDIT');
  if (!owned) {
    return { error: 'Unauthorized' };
  }

  try {
    const card = await prisma.$transaction(async (tx) => {
      const columns = await tx.column.findMany({
        where: { projectId: owned.project.id },
      });
      const done = doneColumnFrom(columns);
      if (done == null) {
        throw new NoDoneColumnError();
      }

      const target = parsed.data.completed ? done : inboxColumnFrom(columns);
      if (target == null) {
        throw new NoOpenColumnError();
      }

      if (!parsed.data.completed && owned.card.columnId !== done.id) {
        const current = await tx.card.findFirst({
          where: { id: parsed.data.cardId, columnId: owned.card.columnId },
        });
        if (!current) {
          throw new OccupancyError();
        }
        return current;
      }

      if (owned.card.columnId === target.id) {
        const current = await tx.card.findFirst({
          where: { id: parsed.data.cardId, columnId: owned.card.columnId },
        });
        if (!current) {
          throw new OccupancyError();
        }
        return current;
      }

      const [last] = await tx.card.findMany({
        where: { columnId: target.id },
        orderBy: { order: 'desc' },
        take: 1,
      });
      const order = (typeof last?.order === 'number' ? last.order : 0) + 1;
      const claimed = await tx.card.updateMany({
        where: { id: parsed.data.cardId, columnId: owned.card.columnId },
        data: { columnId: target.id, order },
      });
      if (claimed.count !== 1) {
        throw new OccupancyError();
      }

      const moved = await tx.card.findFirst({ where: { id: parsed.data.cardId } });
      if (!moved) {
        throw new OccupancyError();
      }

      const fromColumn = columns.find((column) => column.id === owned.card.columnId);
      await recordActivityEvent(tx, {
        projectId: owned.project.id,
        actorId: session.user.id,
        type: 'CARD_MOVED',
        payload: {
          ...activityActorFromSession(session.user),
          cardId: moved.id,
          cardTitle: moved.title,
          fromColumnId: owned.column.id,
          fromColumnTitle: fromColumn?.title ?? owned.column.title,
          toColumnId: target.id,
          toColumnTitle: target.title,
        },
      });

      return moved;
    });

    revalidatePath(projectPath(owned.project.id));
    revalidatePath(MY_TASKS_PATH);

    return {
      data: {
        id: card.id,
        title: card.title,
        description: card.description,
        code: typeof card.code === 'string' ? card.code : '',
        order: card.order,
        columnId: card.columnId,
        completed: parsed.data.completed,
      },
    };
  } catch (error) {
    if (error instanceof OccupancyError) {
      return { error: 'Unauthorized' };
    }
    if (error instanceof NoDoneColumnError) {
      return { error: NO_DONE_COLUMN_MESSAGE };
    }
    if (error instanceof NoOpenColumnError) {
      return { error: NO_OPEN_COLUMN_MESSAGE };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
