'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import {
  claimPendingInvitation,
  InvitationNotPendingError,
  invitationAcceptedMessage,
} from '@/lib/invitations';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { PROJECTS_PATH, projectPath } from '@/lib/routes';
import { acceptInvitationSchema } from '@/lib/validation/invitation';

type AcceptInvitationResult = { data: { id: string } } | { error: string };

export async function acceptInvitation(invitationId: string): Promise<AcceptInvitationResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = acceptInvitationSchema.safeParse({ invitationId });
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const invitation = await prisma.invitation.findFirst({
    where: { id: parsed.data.invitationId },
  });
  if (!invitation || invitation.inviteeId !== session.user.id) {
    return { error: 'Unauthorized' };
  }

  const invitee = await prisma.user.findFirst({ where: { id: session.user.id } });
  const project = await prisma.project.findFirst({ where: { id: invitation.projectId } });
  if (!invitee || !project) {
    return { error: 'Unauthorized' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await claimPendingInvitation(tx, { id: invitation.id, status: 'ACCEPTED' });
      await tx.membership.create({
        data: {
          userId: invitation.inviteeId,
          projectId: invitation.projectId,
          role: 'MEMBER',
          access: 'COMMENT',
        },
      });
      await tx.notification.create({
        data: {
          type: 'INVITATION_ACCEPTED',
          message: invitationAcceptedMessage(invitee.name, project.title),
          read: false,
          recipientId: invitation.inviterId,
          invitationId: invitation.id,
        },
      });
      await tx.notification.deleteMany({
        where: {
          invitationId: invitation.id,
          type: 'INVITATION_RECEIVED',
          recipientId: invitation.inviteeId,
        },
      });
    });

    revalidatePath(PROJECTS_PATH);
    revalidatePath(projectPath(invitation.projectId));
    return { data: { id: invitation.id } };
  } catch (error) {
    if (error instanceof InvitationNotPendingError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
