'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import {
  claimPendingInvitation,
  InvitationNotPendingError,
  invitationRejectedMessage,
} from '@/lib/invitations';
import { GENERIC_ERROR_MESSAGE, INVITATION_NO_LONGER_VALID_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { PROJECTS_PATH, projectPath } from '@/lib/routes';
import { rejectInvitationSchema } from '@/lib/validation/invitation';

type RejectInvitationResult = { data: { id: string } } | { error: string };

export async function rejectInvitation(invitationId: string): Promise<RejectInvitationResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = rejectInvitationSchema.safeParse({ invitationId });
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
      await claimPendingInvitation(tx, {
        id: invitation.id,
        status: 'REJECTED',
        role: invitation.role,
        inviterId: invitation.inviterId,
      });
      await tx.notification.create({
        data: {
          type: 'INVITATION_REJECTED',
          message: invitationRejectedMessage(invitee.name, project.title),
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
      return { error: INVITATION_NO_LONGER_VALID_MESSAGE };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
