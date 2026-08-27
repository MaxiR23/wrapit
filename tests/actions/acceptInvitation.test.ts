// tests/actions/acceptInvitation.test.ts
//
// Tests for the acceptInvitation server action.
//
// Tested:
// - The invitee accepts: status ACCEPTED, MEMBER membership, inviter notified,
//   received notification deleted
// - Inviter and a third user cannot accept; invitation stays PENDING
// - Non-PENDING invitations are refused without writing
// - A second accept, or a reject after accept, loses: Unauthorized and no extra writes
// - A mid-transaction failure rolls back every write
// - Rejects the call when there is no session
// - Rejects an empty, oversized, or non-string invitation id without a lookup
//
// What is covered:
// - Happy path, authorization, transaction rollback, unauthorized, invalid id
//
// Run with: pnpm test:run tests/actions/acceptInvitation.test.ts
//
// SEE: src/actions/acceptInvitation.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
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

const inviter = { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' };
const invitee = { id: 'user-max', name: 'Maxi', username: 'maxi' };

describe('acceptInvitation', () => {
  beforeEach(async () => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: invitee });
    await db.user.create({ data: inviter });
    await db.user.create({ data: invitee });
  });

  async function seedPendingInvite() {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: inviter.id,
    });
    const invitation = await db.invitation.create({
      data: {
        id: 'invite-1',
        projectId: project.id,
        inviterId: inviter.id,
        inviteeId: invitee.id,
        status: 'PENDING',
        role: 'MEMBER',
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
    expect(db.membership.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: invitee.id,
          projectId: project.id,
          role: 'MEMBER',
          access: 'COMMENT',
        }),
      ]),
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
        }),
      }),
    ]);
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

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.membership.rows).toHaveLength(1);
    expect(db.notification.rows).toHaveLength(1);
  });

  it('lets only the first of two accepts win', async () => {
    const { invitation } = await seedPendingInvite();
    const membershipCountAfterSeed = db.membership.rows.length;

    const first = await acceptInvitation(invitation.id);
    const second = await acceptInvitation(invitation.id);

    expect(first).toEqual({ data: { id: invitation.id } });
    expect(second).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'ACCEPTED' }));
    expect(db.membership.rows).toHaveLength(membershipCountAfterSeed + 1);
    expect(db.notification.rows).toEqual([
      expect.objectContaining({ type: 'INVITATION_ACCEPTED', invitationId: invitation.id }),
    ]);
  });

  it('keeps an accepted invitation when a later reject arrives', async () => {
    const { invitation } = await seedPendingInvite();
    const membershipCountAfterSeed = db.membership.rows.length;

    const accepted = await acceptInvitation(invitation.id);
    const rejected = await rejectInvitation(invitation.id);

    expect(accepted).toEqual({ data: { id: invitation.id } });
    expect(rejected).toEqual({ error: 'Unauthorized' });
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
