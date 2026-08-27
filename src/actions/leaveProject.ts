'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { unassignUserFromProject } from '@/lib/membership';
import { GENERIC_ERROR_MESSAGE, OWNER_MUST_TRANSFER_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { MY_TASKS_PATH, PROJECTS_PATH, projectPath } from '@/lib/routes';
import { leaveProjectSchema } from '@/lib/validation/membership';

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

class OwnerMustTransferError extends Error {
  constructor() {
    super(OWNER_MUST_TRANSFER_MESSAGE);
    this.name = 'OwnerMustTransferError';
  }
}

type LeaveProjectResult = { data: { projectId: string } } | { error: string };

export async function leaveProject(input: { projectId: string }): Promise<LeaveProjectResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = leaveProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const { projectId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.membership.deleteMany({
        where: {
          projectId,
          userId: session.user.id,
          role: { not: 'OWNER' },
        },
      });
      if (deleted.count !== 1) {
        const remaining = await tx.membership.findFirst({
          where: { projectId, userId: session.user.id },
        });
        if (remaining?.role === 'OWNER') {
          throw new OwnerMustTransferError();
        }
        throw new UnauthorizedWriteError();
      }

      await unassignUserFromProject(tx, { userId: session.user.id, projectId });
      await tx.recentProject.deleteMany({
        where: { userId: session.user.id, projectId },
      });

      await recordActivityEvent(tx, {
        projectId,
        actorId: session.user.id,
        type: 'MEMBER_LEFT',
        payload: activityActorFromSession(session.user),
      });
    });

    revalidatePath(projectPath(projectId));
    revalidatePath(PROJECTS_PATH);
    revalidatePath(MY_TASKS_PATH);
    return { data: { projectId } };
  } catch (error) {
    if (error instanceof OwnerMustTransferError) {
      return { error: OWNER_MUST_TRANSFER_MESSAGE };
    }
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
