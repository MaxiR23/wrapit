'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

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
