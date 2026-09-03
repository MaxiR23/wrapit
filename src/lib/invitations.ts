import { logInfo } from '@/lib/log';

export type InviteDeniedReason =
  'unknown_username' | 'self' | 'already_member' | 'pending_invitation' | 'accepted_invitation';

export type InvitationRow = {
  id: string;
  projectId: string;
  inviterId: string;
  inviteeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

type InvitationTx = {
  invitation: {
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<Record<string, unknown> | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    createMany: (args: {
      data: Record<string, unknown>[];
      skipDuplicates?: boolean;
    }) => Promise<{ count: number }>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<Record<string, unknown>>;
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  notification: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export type InvitationDb = {
  $transaction: <T>(fn: (tx: InvitationTx) => Promise<T>) => Promise<T>;
  user: {
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<Record<string, unknown> | null>;
  };
  membership: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<unknown>;
  };
  invitation: {
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<Record<string, unknown> | null>;
  };
  project: {
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<Record<string, unknown> | null>;
  };
} & InvitationTx;

export type InviteUserResult =
  { ok: true; invitation: InvitationRow } | { ok: false; reason: InviteDeniedReason };

export function invitationReceivedMessage(inviterName: string, projectTitle: string): string {
  return `${inviterName} invited you to ${projectTitle}`;
}

export function invitationAcceptedMessage(inviteeName: string, projectTitle: string): string {
  return `${inviteeName} accepted your invitation to ${projectTitle}`;
}

export function invitationRejectedMessage(inviteeName: string, projectTitle: string): string {
  return `${inviteeName} declined your invitation to ${projectTitle}`;
}

/** Same trim + lowercase the invitee lookup uses, so callers can dedupe against it. */
export function normalizeInviteUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class InvitationNotPendingError extends Error {
  constructor() {
    super('Invitation is not pending');
    this.name = 'InvitationNotPendingError';
  }
}

/**
 * First write of accept/reject: claim the PENDING row the caller read, or
 * throw so the transaction rolls back. The where includes role and inviterId
 * because REJECTED reuse now rewrites both; a miss means the invitation the
 * caller was looking at no longer exists. Count !== 1 means another request
 * already won.
 */
export async function claimPendingInvitation(
  tx: {
    invitation: {
      updateMany: (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => Promise<{ count: number }>;
    };
  },
  input: {
    id: string;
    status: 'ACCEPTED' | 'REJECTED';
    role: InvitationRow['role'];
    inviterId: string;
  },
): Promise<void> {
  const result = await tx.invitation.updateMany({
    where: {
      id: input.id,
      status: 'PENDING',
      role: input.role,
      inviterId: input.inviterId,
    },
    data: { status: input.status },
  });
  if (result.count !== 1) {
    throw new InvitationNotPendingError();
  }
}

function deny(
  reason: InviteDeniedReason,
  details: { projectId: string; inviterId: string; username?: string },
): InviteUserResult {
  logInfo('invite.denied', { reason, ...details });
  return { ok: false, reason };
}

/**
 * Resolve a username to an invitee and write a PENDING invitation plus an
 * INVITATION_RECEIVED notification. Does not check that the inviter is a
 * member — the caller must do that first.
 *
 * Every non-invitable target returns `{ ok: false }` and writes nothing.
 * Reuses a REJECTED row for the same (project, invitee) instead of inserting.
 * First-time insert uses createMany + skipDuplicates so a concurrent create
 * returns pending_invitation instead of throwing.
 */
export async function inviteUserToProject(
  db: InvitationDb,
  input: { projectId: string; inviterId: string; username: string; role?: 'ADMIN' | 'MEMBER' },
): Promise<InviteUserResult> {
  const username = normalizeInviteUsername(input.username);
  const { projectId, inviterId } = input;
  const role = input.role ?? 'MEMBER';

  const invitee = await db.user.findFirst({ where: { username } });
  if (!invitee) {
    return deny('unknown_username', { projectId, inviterId, username });
  }
  const inviteeId = String(invitee.id);
  if (inviteeId === inviterId) {
    return deny('self', { projectId, inviterId, username });
  }

  const membership = await db.membership.findFirst({
    where: { userId: inviteeId, projectId },
  });
  if (membership) {
    return deny('already_member', { projectId, inviterId, username });
  }

  const existing = await db.invitation.findFirst({
    where: { projectId, inviteeId },
  });
  if (existing?.status === 'PENDING') {
    return deny('pending_invitation', { projectId, inviterId, username });
  }
  if (existing?.status === 'ACCEPTED') {
    return deny('accepted_invitation', { projectId, inviterId, username });
  }

  const inviter = await db.user.findFirst({ where: { id: inviterId } });
  const project = await db.project.findFirst({ where: { id: projectId } });
  if (!inviter || !project) {
    throw new Error('inviter or project missing after access check');
  }

  const message = invitationReceivedMessage(String(inviter.name), String(project.title));

  return db.$transaction(async (tx) => {
    let invitation: Record<string, unknown>;
    if (existing) {
      const claimed = await tx.invitation.updateMany({
        where: { id: String(existing.id), status: 'REJECTED' },
        data: { status: 'PENDING', inviterId, role },
      });
      if (claimed.count !== 1) {
        return deny('pending_invitation', { projectId, inviterId, username });
      }
      const claimedInvitation = await tx.invitation.findFirst({
        where: { id: String(existing.id) },
      });
      if (!claimedInvitation) {
        throw new Error('claimed invitation missing');
      }
      invitation = claimedInvitation;
    } else {
      const created = await tx.invitation.createMany({
        data: [
          {
            projectId,
            inviterId,
            inviteeId,
            role,
            status: 'PENDING',
          },
        ],
        skipDuplicates: true,
      });
      if (created.count !== 1) {
        return deny('pending_invitation', { projectId, inviterId, username });
      }
      const createdInvitation = await tx.invitation.findFirst({
        where: { projectId, inviteeId },
      });
      if (!createdInvitation) {
        throw new Error('created invitation missing');
      }
      invitation = createdInvitation;
    }

    await tx.notification.create({
      data: {
        type: 'INVITATION_RECEIVED',
        message,
        read: false,
        recipientId: inviteeId,
        invitationId: invitation.id,
      },
    });

    return { ok: true as const, invitation: invitation as InvitationRow };
  });
}
