'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { inviteUserToProject, type InvitationDb } from '@/lib/invitations';
import { logInfo } from '@/lib/log';
import { administeredByUser } from '@/lib/membership';
import { CANT_INVITE_USER_MESSAGE, GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { invitationSchema } from '@/lib/validation/invitation';

type CreateInvitationResult =
  | {
      data: {
        id: string;
        projectId: string;
        inviterId: string;
        inviteeId: string;
        status: string;
        role: string;
      };
    }
  | { error: string };

export async function createInvitation(input: {
  projectId: string;
  username: string;
}): Promise<CreateInvitationResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) {
    const projectIdIssue = parsed.error.issues.some((issue) => issue.path.includes('projectId'));
    if (projectIdIssue) {
      return { error: 'Unauthorized' };
    }
    logInfo('invite.denied', {
      reason: 'unknown_username',
      inviterId: session.user.id,
    });
    return { error: CANT_INVITE_USER_MESSAGE };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...administeredByUser(session.user.id) },
  });
  if (!project) {
    return { error: 'Unauthorized' };
  }

  try {
    const result = await inviteUserToProject(prisma as unknown as InvitationDb, {
      projectId: project.id,
      inviterId: session.user.id,
      username: parsed.data.username,
    });
    if (!result.ok) {
      return { error: CANT_INVITE_USER_MESSAGE };
    }

    revalidatePath(projectPath(project.id));
    return { data: result.invitation };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
