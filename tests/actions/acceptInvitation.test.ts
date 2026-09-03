// tests/actions/acceptInvitation.test.ts
//
// Tests for the acceptInvitation server action.
//
// Tested:
// - The invitee accepts: status ACCEPTED, membership with the granted role and
//   EDIT access, accessBeforeAdmin null, inviter notified, received
//   notification deleted
// - Accepting ADMIN yields ADMIN plus EDIT when the inviter still administers
// - Accepting MEMBER yields MEMBER plus EDIT
// - An ADMIN invitation from a since-demoted or departed inviter yields MEMBER
// - A demote, removal, or leave that lands between membership create and the
//   ADMIN occupancy write still joins as MEMBER with EDIT and the accept succeeds
// - MEMBER_ADDED records the granted role on both the grant hit and miss
// - An invited ADMIN later demoted lands on EDIT with accessBeforeAdmin null
// - After every path, OWNER and ADMIN remain at EDIT
// - Inviter and a third user cannot accept; invitation stays PENDING
// - Non-PENDING invitations are refused without writing
// - A second accept, or a reject after accept, loses: invitation no longer
//   valid and no extra writes
// - A pending ADMIN invite rewritten as MEMBER, or with a new inviter, cannot
//   be accepted from the stale snapshot
// - A mid-transaction failure rolls back every write
// - Rejects the call when there is no session
// - Rejects an empty, oversized, or non-string invitation id without a lookup
//
// What is covered:
// - Happy path, granted role, grant re-check, demotion restore, authorization,
//   transaction rollback, unauthorized, invalid id
//
// Run with: pnpm test:run tests/actions/acceptInvitation.test.ts
//
// SEE: src/actions/acceptInvitation.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { GENERIC_ERROR_MESSAGE, INVITATION_NO_LONGER_VALID_MESSAGE } from '@/lib/messages';
import { MAX_ID_LENGTH } from '@/lib/validation/id';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
const getSession = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: db }));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/cache', () => ({
  revalidatePath,
}));

const { acceptInvitation } = await import('@/actions/acceptInvitation');
const { rejectInvitation } = await import('@/actions/rejectInvitation');
const { updateMembershipRole } = await import('@/actions/updateMembershipRole');

const inviter = { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' };
const invitee = { id: 'user-max', name: 'Maxi', username: 'maxi' };
const owner = { id: 'user-owner', name: 'Owner', username: 'owner' };

describe('acceptInvitation', () => {
  beforeEach(async () => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: invitee });
    await db.user.create({ data: inviter });
    await db.user.create({ data: invitee });
  });

  function expectPrivilegedEdit(rows: Array<Record<string, unknown>>) {
    for (const row of rows) {
      if (row.role === 'OWNER' || row.role === 'ADMIN') {
        expect(row.access).toBe('EDIT');
      }
    }
  }

  function inviteeMembership(projectId: string) {
    return db.membership.rows.find(
      (row) => row.userId === invitee.id && row.projectId === projectId,
    );
  }

  function afterInviteeMembershipCreated(mutate: () => Promise<void>) {
    db.membership.create.mockImplementationOnce(async (args: { data: Record<string, unknown> }) => {
      const created = await db.membership.create(args);
      await mutate();
      return created;
    });
  }

  async function seedPendingInvite(options?: {
    role?: 'OWNER' | 'ADMIN' | 'MEMBER';
    inviterRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
  }) {
    const role = options?.role ?? 'MEMBER';
    const inviterRole = options?.inviterRole ?? 'OWNER';
    let project;
    if (inviterRole === 'OWNER') {
      project = await seedAccessibleProject(db, {
        title: 'Sprint board',
        userId: inviter.id,
      });
    } else {
      await db.user.create({ data: owner });
      project = await seedAccessibleProject(db, {
        title: 'Sprint board',
        userId: owner.id,
        ownerId: owner.id,
        role: 'OWNER',
      });
      await db.membership.create({
        data: {
          userId: inviter.id,
          projectId: project.id,
          role: inviterRole,
          access: 'EDIT',
        },
      });
    }
    const invitation = await db.invitation.create({
      data: {
        id: 'invite-1',
        projectId: project.id,
        inviterId: inviter.id,
        inviteeId: invitee.id,
        status: 'PENDING',
        role,
      },
    });
    await db.notification.create({
      data: {
        id: 'notif-received',
        type: 'INVITATION_RECEIVED',
        message: 'Ada Lovelace invited you to Sprint board',
        read: false,
        recipientId: invitee.id,
        invitationId: invitation.id,
      },
    });
    return { project, invitation };
  }

  it('accepts as the invitee, creates membership, notifies the inviter, and deletes the received row', async () => {
    const { project, invitation } = await seedPendingInvite();

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ data: { id: invitation.id } });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'ACCEPTED' }));
    expect(inviteeMembership(project.id)).toEqual(
      expect.objectContaining({
        userId: invitee.id,
        projectId: project.id,
        role: 'MEMBER',
        access: 'EDIT',
        accessBeforeAdmin: null,
      }),
    );
    expect(db.notification.rows).toEqual([
      expect.objectContaining({
        type: 'INVITATION_ACCEPTED',
        recipientId: inviter.id,
        invitationId: invitation.id,
        message: 'Maxi accepted your invitation to Sprint board',
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
    expect(db.activityEvent.rows).toEqual([
      expect.objectContaining({
        type: 'MEMBER_ADDED',
        projectId: project.id,
        actorId: invitee.id,
        payload: expect.objectContaining({
          actorName: 'Maxi',
          memberId: invitee.id,
          inviterId: inviter.id,
          inviterName: 'Ada Lovelace',
          role: 'MEMBER',
        }),
      }),
    ]);
    expectPrivilegedEdit(db.membership.rows);
  });

  it('accepts an ADMIN invitation as ADMIN with EDIT when the inviter still administers', async () => {
    const { project, invitation } = await seedPendingInvite({ role: 'ADMIN' });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ data: { id: invitation.id } });
    expect(inviteeMembership(project.id)).toEqual(
      expect.objectContaining({
        role: 'ADMIN',
        access: 'EDIT',
        accessBeforeAdmin: null,
      }),
    );
    expect(db.activityEvent.rows[0]?.payload).toEqual(expect.objectContaining({ role: 'ADMIN' }));
    expectPrivilegedEdit(db.membership.rows);
  });

  it('grants MEMBER when an ADMIN invitation is accepted after the inviter was demoted', async () => {
    const { project, invitation } = await seedPendingInvite({
      role: 'ADMIN',
      inviterRole: 'ADMIN',
    });
    const inviterMembership = db.membership.rows.find(
      (row) => row.userId === inviter.id && row.projectId === project.id,
    );
    await db.membership.update({
      where: { id: String(inviterMembership?.id) },
      data: { role: 'MEMBER', access: 'EDIT' },
    });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ data: { id: invitation.id } });
    expect(inviteeMembership(project.id)).toEqual(
      expect.objectContaining({
        role: 'MEMBER',
        access: 'EDIT',
        accessBeforeAdmin: null,
      }),
    );
    expect(db.activityEvent.rows[0]?.payload).toEqual(expect.objectContaining({ role: 'MEMBER' }));
    expectPrivilegedEdit(db.membership.rows);
  });

  it('grants MEMBER when an ADMIN invitation is accepted after the inviter left', async () => {
    const { project, invitation } = await seedPendingInvite({
      role: 'ADMIN',
      inviterRole: 'ADMIN',
    });
    await db.membership.deleteMany({
      where: { userId: inviter.id, projectId: project.id },
    });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ data: { id: invitation.id } });
    expect(inviteeMembership(project.id)).toEqual(
      expect.objectContaining({
        role: 'MEMBER',
        access: 'EDIT',
        accessBeforeAdmin: null,
      }),
    );
    expect(db.activityEvent.rows[0]?.payload).toEqual(expect.objectContaining({ role: 'MEMBER' }));
    expectPrivilegedEdit(db.membership.rows);
  });

  it('joins as MEMBER when the inviter is demoted between create and the ADMIN occupancy write', async () => {
    const { project, invitation } = await seedPendingInvite({
      role: 'ADMIN',
      inviterRole: 'ADMIN',
    });
    afterInviteeMembershipCreated(async () => {
      const inviterMembership = db.membership.rows.find(
        (row) => row.userId === inviter.id && row.projectId === project.id,
      );
      await db.membership.update({
        where: { id: String(inviterMembership?.id) },
        data: { role: 'MEMBER', access: 'EDIT' },
      });
    });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ data: { id: invitation.id } });
    expect(result).not.toEqual({ error: INVITATION_NO_LONGER_VALID_MESSAGE });
    expect(result).not.toEqual({ error: 'Unauthorized' });
    expect(inviteeMembership(project.id)).toEqual(
      expect.objectContaining({
        role: 'MEMBER',
        access: 'EDIT',
        accessBeforeAdmin: null,
      }),
    );
    expect(db.activityEvent.rows[0]?.payload).toEqual(expect.objectContaining({ role: 'MEMBER' }));
    expectPrivilegedEdit(db.membership.rows);
  });

  it('joins as MEMBER when the inviter is removed between create and the ADMIN occupancy write', async () => {
    const { project, invitation } = await seedPendingInvite({
      role: 'ADMIN',
      inviterRole: 'ADMIN',
    });
    afterInviteeMembershipCreated(async () => {
      await db.membership.deleteMany({
        where: { userId: inviter.id, projectId: project.id },
      });
    });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ data: { id: invitation.id } });
    expect(result).not.toEqual({ error: INVITATION_NO_LONGER_VALID_MESSAGE });
    expect(inviteeMembership(project.id)).toEqual(
      expect.objectContaining({
        role: 'MEMBER',
        access: 'EDIT',
        accessBeforeAdmin: null,
      }),
    );
    expectPrivilegedEdit(db.membership.rows);
  });

  it('joins as MEMBER when the inviter leaves between create and the ADMIN occupancy write', async () => {
    const { project, invitation } = await seedPendingInvite({
      role: 'ADMIN',
      inviterRole: 'ADMIN',
    });
    afterInviteeMembershipCreated(async () => {
      await db.membership.deleteMany({
        where: { userId: inviter.id, projectId: project.id },
      });
    });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ data: { id: invitation.id } });
    expect(result).not.toEqual({ error: GENERIC_ERROR_MESSAGE });
    expect(inviteeMembership(project.id)).toEqual(
      expect.objectContaining({
        role: 'MEMBER',
        access: 'EDIT',
        accessBeforeAdmin: null,
      }),
    );
    expect(db.activityEvent.rows[0]?.payload).toEqual(expect.objectContaining({ role: 'MEMBER' }));
    expectPrivilegedEdit(db.membership.rows);
  });

  it('lands an invited ADMIN on EDIT with a null column after a later demotion', async () => {
    const { project, invitation } = await seedPendingInvite({ role: 'ADMIN' });

    expect(await acceptInvitation(invitation.id)).toEqual({ data: { id: invitation.id } });
    const joined = inviteeMembership(project.id);
    expect(joined).toEqual(
      expect.objectContaining({ role: 'ADMIN', access: 'EDIT', accessBeforeAdmin: null }),
    );

    getSession.mockResolvedValue({ user: inviter });
    const result = await updateMembershipRole({
      projectId: project.id,
      membershipId: String(joined?.id),
      role: 'MEMBER',
    });

    expect(result).toEqual({ data: { role: 'MEMBER', access: 'EDIT' } });
    expect(inviteeMembership(project.id)).toEqual(
      expect.objectContaining({
        role: 'MEMBER',
        access: 'EDIT',
        accessBeforeAdmin: null,
      }),
    );
    expectPrivilegedEdit(db.membership.rows);
  });

  it('rejects an invite to an archived project without writing', async () => {
    const { project, invitation } = await seedPendingInvite();
    await db.project.update({
      where: { id: project.id },
      data: { archivedAt: new Date('2026-08-09T10:00:00.000Z') },
    });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'PENDING' }));
    expect(db.membership.rows).toHaveLength(1);
    expectPrivilegedEdit(db.membership.rows);
  });

  it('rejects when the inviter tries to accept', async () => {
    const { invitation } = await seedPendingInvite();
    getSession.mockResolvedValue({ user: inviter });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'PENDING' }));
    expect(db.membership.rows).toHaveLength(1);
    expect(db.notification.rows).toHaveLength(1);
  });

  it('rejects when a third user tries to accept', async () => {
    const { invitation } = await seedPendingInvite();
    getSession.mockResolvedValue({ user: { id: 'user-other', name: 'Other' } });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'PENDING' }));
  });

  it('rejects a non-PENDING invitation without writing', async () => {
    const { invitation } = await seedPendingInvite();
    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: 'REJECTED' },
    });

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ error: INVITATION_NO_LONGER_VALID_MESSAGE });
    expect(result).not.toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows).toHaveLength(1);
    expect(db.notification.rows).toHaveLength(1);
  });

  it('lets only the first of two accepts win', async () => {
    const { invitation } = await seedPendingInvite();
    const membershipCountAfterSeed = db.membership.rows.length;

    const first = await acceptInvitation(invitation.id);
    const second = await acceptInvitation(invitation.id);

    expect(first).toEqual({ data: { id: invitation.id } });
    expect(second).toEqual({ error: INVITATION_NO_LONGER_VALID_MESSAGE });
    expect(second).not.toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'ACCEPTED' }));
    expect(db.membership.rows).toHaveLength(membershipCountAfterSeed + 1);
    expect(db.notification.rows).toEqual([
      expect.objectContaining({ type: 'INVITATION_ACCEPTED', invitationId: invitation.id }),
    ]);
    expectPrivilegedEdit(db.membership.rows);
  });

  it('cannot accept a stale ADMIN role after the row was re-invited as MEMBER', async () => {
    const { invitation } = await seedPendingInvite({ role: 'ADMIN' });
    const stale = { ...db.invitation.rows[0]! };
    const membershipCountAfterSeed = db.membership.rows.length;
    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: 'PENDING', role: 'MEMBER', inviterId: inviter.id },
    });
    db.invitation.findFirst.mockImplementationOnce(async () => stale);

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ error: INVITATION_NO_LONGER_VALID_MESSAGE });
    expect(result).not.toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(
      expect.objectContaining({ status: 'PENDING', role: 'MEMBER', inviterId: inviter.id }),
    );
    expect(db.membership.rows).toHaveLength(membershipCountAfterSeed);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('cannot accept with a stale inviter after REJECTED reuse assigned a new one', async () => {
    const { project, invitation } = await seedPendingInvite({
      role: 'ADMIN',
      inviterRole: 'ADMIN',
    });
    const stale = { ...db.invitation.rows[0]! };
    const membershipCountAfterSeed = db.membership.rows.length;
    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: 'PENDING', role: 'ADMIN', inviterId: owner.id },
    });
    db.invitation.findFirst.mockImplementationOnce(async () => stale);

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ error: INVITATION_NO_LONGER_VALID_MESSAGE });
    expect(result).not.toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(
      expect.objectContaining({ status: 'PENDING', role: 'ADMIN', inviterId: owner.id }),
    );
    expect(db.membership.rows).toHaveLength(membershipCountAfterSeed);
    expect(inviteeMembership(project.id)).toBeUndefined();
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('keeps an accepted invitation when a later reject arrives', async () => {
    const { invitation } = await seedPendingInvite();
    const membershipCountAfterSeed = db.membership.rows.length;

    const accepted = await acceptInvitation(invitation.id);
    const rejected = await rejectInvitation(invitation.id);

    expect(accepted).toEqual({ data: { id: invitation.id } });
    expect(rejected).toEqual({ error: INVITATION_NO_LONGER_VALID_MESSAGE });
    expect(rejected).not.toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'ACCEPTED' }));
    expect(db.membership.rows).toHaveLength(membershipCountAfterSeed + 1);
    expect(db.notification.rows).toEqual([
      expect.objectContaining({ type: 'INVITATION_ACCEPTED' }),
    ]);
    expect(db.notification.rows.some((row) => row.type === 'INVITATION_REJECTED')).toBe(false);
  });

  it('rolls back every write when membership create fails mid-transaction', async () => {
    const { invitation } = await seedPendingInvite();
    const membershipCountBefore = db.membership.rows.length;
    db.membership.create.mockRejectedValueOnce(new Error('unique constraint'));

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ error: GENERIC_ERROR_MESSAGE });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'PENDING' }));
    expect(db.membership.rows).toHaveLength(membershipCountBefore);
    expect(db.notification.rows).toEqual([
      expect.objectContaining({ id: 'notif-received', type: 'INVITATION_RECEIVED' }),
    ]);
    expect(db.activityEvent.rows).toHaveLength(0);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await acceptInvitation('invite-1');

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('rejects an invalid invitation id without a lookup', async () => {
    db.invitation.findFirst.mockClear();

    expect(await acceptInvitation('')).toEqual({ error: 'Unauthorized' });
    expect(await acceptInvitation('   ')).toEqual({ error: 'Unauthorized' });
    expect(await acceptInvitation('a'.repeat(MAX_ID_LENGTH + 1))).toEqual({
      error: 'Unauthorized',
    });
    expect(await acceptInvitation(1 as unknown as string)).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.findFirst).not.toHaveBeenCalled();
    expect(db.project.rows).toHaveLength(0);
  });

  it('rolls back the membership when logging fails', async () => {
    const { invitation } = await seedPendingInvite();
    const membershipCountBefore = db.membership.rows.length;
    db.activityEvent.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await acceptInvitation(invitation.id);

    expect(result).toEqual({ error: GENERIC_ERROR_MESSAGE });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'PENDING' }));
    expect(db.membership.rows).toHaveLength(membershipCountBefore);
    expect(db.activityEvent.rows).toHaveLength(0);
  });
});
