// tests/lib/invitations.test.ts
//
// Tests for inviteUserToProject and invitation notification copy.
//
// Tested:
// - Creates a PENDING MEMBER invitation and INVITATION_RECEIVED notification
// - Denies unknown username, self, existing member, pending, and accepted
//   invitations without writing
// - Reuses a REJECTED row instead of inserting a second invitation
// - Two overlapping re-invites on the same REJECTED row: one PENDING winner,
//   one INVITATION_RECEIVED, loser returns pending_invitation
// - Two overlapping first-time invites: one PENDING winner, one
//   INVITATION_RECEIVED, loser returns pending_invitation
// - Logs the internal deny reason without putting it on the result
//
// What is covered:
// - Happy path, each deny reason, REJECTED reuse, concurrent invite, logging
//
// Run with: pnpm test:run tests/lib/invitations.test.ts
//
// SEE: src/lib/invitations.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const logInfo = vi.fn();

vi.mock('@/lib/log', () => ({ logInfo }));

const {
  inviteUserToProject,
  invitationReceivedMessage,
  invitationAcceptedMessage,
  invitationRejectedMessage,
} = await import('@/lib/invitations');

const db = createPrismaFake();

const inviter = { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' };
const invitee = { id: 'user-max', name: 'Maxi', username: 'maxi' };

describe('inviteUserToProject', () => {
  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
  });

  async function seedInviterProject() {
    await db.user.create({ data: inviter });
    await db.user.create({ data: invitee });
    return seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: inviter.id,
    });
  }

  it('creates a PENDING MEMBER invitation and an INVITATION_RECEIVED notification', async () => {
    const project = await seedInviterProject();

    const result = await inviteUserToProject(db, {
      projectId: project.id,
      inviterId: inviter.id,
      username: 'Maxi',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invitation).toEqual(
      expect.objectContaining({
        projectId: project.id,
        inviterId: inviter.id,
        inviteeId: invitee.id,
        status: 'PENDING',
        role: 'MEMBER',
      }),
    );
    expect(db.invitation.rows).toHaveLength(1);
    expect(db.notification.rows).toEqual([
      expect.objectContaining({
        type: 'INVITATION_RECEIVED',
        recipientId: invitee.id,
        invitationId: result.invitation.id,
        message: 'Ada Lovelace invited you to Sprint board',
        read: false,
      }),
    ]);
    expect(logInfo).not.toHaveBeenCalled();
  });

  it('denies an unknown username without writing', async () => {
    const project = await seedInviterProject();

    const result = await inviteUserToProject(db, {
      projectId: project.id,
      inviterId: inviter.id,
      username: 'nobody',
    });

    expect(result).toEqual({ ok: false, reason: 'unknown_username' });
    expect(db.invitation.rows).toHaveLength(0);
    expect(db.notification.rows).toHaveLength(0);
    expect(logInfo).toHaveBeenCalledWith(
      'invite.denied',
      expect.objectContaining({ reason: 'unknown_username', projectId: project.id }),
    );
  });

  it('denies inviting yourself without writing', async () => {
    const project = await seedInviterProject();

    const result = await inviteUserToProject(db, {
      projectId: project.id,
      inviterId: inviter.id,
      username: 'ada',
    });

    expect(result).toEqual({ ok: false, reason: 'self' });
    expect(db.invitation.rows).toHaveLength(0);
    expect(db.notification.rows).toHaveLength(0);
    expect(logInfo).toHaveBeenCalledWith(
      'invite.denied',
      expect.objectContaining({ reason: 'self' }),
    );
  });

  it('denies an existing member without writing', async () => {
    const project = await seedInviterProject();
    await db.membership.create({
      data: { userId: invitee.id, projectId: project.id, role: 'MEMBER', starred: false },
    });

    const result = await inviteUserToProject(db, {
      projectId: project.id,
      inviterId: inviter.id,
      username: 'maxi',
    });

    expect(result).toEqual({ ok: false, reason: 'already_member' });
    expect(db.invitation.rows).toHaveLength(0);
    expect(db.notification.rows).toHaveLength(0);
  });

  it('denies a PENDING invitation without writing', async () => {
    const project = await seedInviterProject();
    await db.invitation.create({
      data: {
        projectId: project.id,
        inviterId: inviter.id,
        inviteeId: invitee.id,
        status: 'PENDING',
        role: 'MEMBER',
      },
    });

    const result = await inviteUserToProject(db, {
      projectId: project.id,
      inviterId: inviter.id,
      username: 'maxi',
    });

    expect(result).toEqual({ ok: false, reason: 'pending_invitation' });
    expect(db.invitation.rows).toHaveLength(1);
    expect(db.notification.rows).toHaveLength(0);
  });

  it('denies an ACCEPTED invitation without writing', async () => {
    const project = await seedInviterProject();
    await db.invitation.create({
      data: {
        projectId: project.id,
        inviterId: inviter.id,
        inviteeId: invitee.id,
        status: 'ACCEPTED',
        role: 'MEMBER',
      },
    });

    const result = await inviteUserToProject(db, {
      projectId: project.id,
      inviterId: inviter.id,
      username: 'maxi',
    });

    expect(result).toEqual({ ok: false, reason: 'accepted_invitation' });
    expect(db.invitation.rows).toHaveLength(1);
    expect(db.notification.rows).toHaveLength(0);
  });

  it('reuses a REJECTED invitation instead of inserting a second row', async () => {
    const project = await seedInviterProject();
    const rejected = await db.invitation.create({
      data: {
        id: 'invite-1',
        projectId: project.id,
        inviterId: 'user-old',
        inviteeId: invitee.id,
        status: 'REJECTED',
        role: 'MEMBER',
      },
    });

    const result = await inviteUserToProject(db, {
      projectId: project.id,
      inviterId: inviter.id,
      username: 'maxi',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invitation.id).toBe(rejected.id);
    expect(db.invitation.rows).toHaveLength(1);
    expect(db.invitation.rows[0]).toEqual(
      expect.objectContaining({
        id: rejected.id,
        status: 'PENDING',
        inviterId: inviter.id,
        role: 'MEMBER',
      }),
    );
    expect(db.notification.rows).toHaveLength(1);
    expect(db.notification.rows[0]).toEqual(
      expect.objectContaining({
        type: 'INVITATION_RECEIVED',
        invitationId: rejected.id,
        recipientId: invitee.id,
      }),
    );
  });

  it('lets only the first overlapping re-invite claim a REJECTED row', async () => {
    const project = await seedInviterProject();
    const rejected = await db.invitation.create({
      data: {
        id: 'invite-1',
        projectId: project.id,
        inviterId: 'user-old',
        inviteeId: invitee.id,
        status: 'REJECTED',
        role: 'MEMBER',
      },
    });
    const input = {
      projectId: project.id,
      inviterId: inviter.id,
      username: 'maxi',
    };

    const first = await inviteUserToProject(db, input);
    db.invitation.findFirst.mockImplementationOnce(async () => ({
      ...db.invitation.rows[0]!,
      status: 'REJECTED',
    }));
    const second = await inviteUserToProject(db, input);

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.invitation.id).toBe(rejected.id);
    expect(second).toEqual({ ok: false, reason: 'pending_invitation' });
    expect(db.invitation.rows).toHaveLength(1);
    expect(db.invitation.rows[0]).toEqual(
      expect.objectContaining({ id: rejected.id, status: 'PENDING', inviterId: inviter.id }),
    );
    expect(db.notification.rows).toHaveLength(1);
    expect(db.notification.rows[0]).toEqual(
      expect.objectContaining({
        type: 'INVITATION_RECEIVED',
        invitationId: rejected.id,
      }),
    );
  });

  it('lets only the first overlapping first-time invite create a row', async () => {
    const project = await seedInviterProject();
    const input = {
      projectId: project.id,
      inviterId: inviter.id,
      username: 'maxi',
    };

    const first = await inviteUserToProject(db, input);
    db.invitation.findFirst.mockImplementationOnce(async () => null);
    const second = await inviteUserToProject(db, input);

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: 'pending_invitation' });
    expect(db.invitation.rows).toHaveLength(1);
    expect(db.invitation.rows[0]).toEqual(
      expect.objectContaining({
        projectId: project.id,
        inviteeId: invitee.id,
        status: 'PENDING',
      }),
    );
    expect(db.notification.rows).toHaveLength(1);
    expect(db.notification.rows[0]).toEqual(
      expect.objectContaining({
        type: 'INVITATION_RECEIVED',
        invitationId: db.invitation.rows[0]?.id,
      }),
    );
  });
});

describe('invitation notification copy', () => {
  it('builds English messages without revealing deny reasons', () => {
    expect(invitationReceivedMessage('Ada Lovelace', 'Sprint board')).toBe(
      'Ada Lovelace invited you to Sprint board',
    );
    expect(invitationAcceptedMessage('Maxi', 'Sprint board')).toBe(
      'Maxi accepted your invitation to Sprint board',
    );
    expect(invitationRejectedMessage('Maxi', 'Sprint board')).toBe(
      'Maxi declined your invitation to Sprint board',
    );
  });
});
