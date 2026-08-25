'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { administeredByUser } from '@/lib/membership';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { updateMembershipAccessSchema } from '@/lib/validation/membership';

type UpdateMembershipAccessResult =
  { data: { access: 'EDIT' | 'COMMENT' | 'VIEW' } } | { error: string };

export async function updateMembershipAccess(input: {
  projectId: string;
  membershipId: string;
  access: string;
}): Promise<UpdateMembershipAccessResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateMembershipAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const { projectId, membershipId, access } = parsed.data;

  try {
    const updated = await prisma.membership.updateMany({
      where: {
        id: membershipId,
        projectId,
        role: 'MEMBER',
        project: administeredByUser(session.user.id),
      },
      data: { access },
    });
    if (updated.count !== 1) {
      return { error: 'Unauthorized' };
    }

    revalidatePath(projectPath(projectId));
    return { data: { access } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
