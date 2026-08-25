'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import {
  administeredByUser,
  assertNotLastOwner,
  LastOwnerError,
  remainingOwnerOnProject,
} from '@/lib/membership';
import { GENERIC_ERROR_MESSAGE, LAST_OWNER_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { removeMemberSchema } from '@/lib/validation/membership';

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

type RemoveMemberResult = { data: { id: string } } | { error: string };

export async function removeMember(input: {
  projectId: string;
  membershipId: string;
}): Promise<RemoveMemberResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const { projectId, membershipId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, ...administeredByUser(session.user.id) },
      });
      if (!project) {
        throw new UnauthorizedWriteError();
      }

      await assertNotLastOwner(tx, { projectId, membershipId });

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

      const deleted = await tx.membership.deleteMany({
        where: {
          id: membershipId,
          projectId,
          userId: { not: session.user.id },
          project: {
            AND: [administeredByUser(session.user.id), remainingOwnerOnProject(membershipId)],
          },
        },
      });
      if (deleted.count !== 1) {
        throw new UnauthorizedWriteError();
      }

      await recordActivityEvent(tx, {
        projectId,
        actorId: session.user.id,
        type: 'MEMBER_REMOVED',
        payload: {
          ...activityActorFromSession(session.user),
          memberId: String(member.id),
          memberName: String(member.name),
          memberUsername: typeof member.username === 'string' ? member.username : '',
        },
      });
    });

    revalidatePath(projectPath(projectId));
    return { data: { id: membershipId } };
  } catch (error) {
    if (error instanceof LastOwnerError) {
      return { error: LAST_OWNER_MESSAGE };
    }
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
