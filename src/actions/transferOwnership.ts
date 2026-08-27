'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { lockProjectRow } from '@/lib/labels';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { transferOwnershipSchema } from '@/lib/validation/membership';

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

type TransferOwnershipResult = { data: { membershipId: string } } | { error: string };

export async function transferOwnership(input: {
  projectId: string;
  membershipId: string;
}): Promise<TransferOwnershipResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = transferOwnershipSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const { projectId, membershipId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await lockProjectRow(tx, projectId);

      const demoted = await tx.membership.updateMany({
        where: { projectId, userId: session.user.id, role: 'OWNER' },
        data: { role: 'ADMIN', access: 'EDIT' },
      });
      if (demoted.count !== 1) {
        throw new UnauthorizedWriteError();
      }

      const promoted = await tx.membership.updateMany({
        where: {
          id: membershipId,
          projectId,
          userId: { not: session.user.id },
          role: { not: 'OWNER' },
        },
        data: { role: 'OWNER', access: 'EDIT' },
      });
      if (promoted.count !== 1) {
        throw new UnauthorizedWriteError();
      }

      const membership = await tx.membership.findFirst({
        where: { id: membershipId, projectId },
      });
      if (!membership) {
        throw new UnauthorizedWriteError();
      }
      const member = await tx.user.findFirst({ where: { id: String(membership.userId) } });
      if (!member) {
        throw new UnauthorizedWriteError();
      }

      await recordActivityEvent(tx, {
        projectId,
        actorId: session.user.id,
        type: 'OWNERSHIP_TRANSFERRED',
        payload: {
          ...activityActorFromSession(session.user),
          memberId: String(member.id),
          memberName: String(member.name),
          memberUsername: typeof member.username === 'string' ? member.username : '',
        },
      });
    });

    revalidatePath(projectPath(projectId));
    return { data: { membershipId } };
  } catch (error) {
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
