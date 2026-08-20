// tests/actions/rejectInvitation.test.ts
//
// Tests for the rejectInvitation server action.
//
// Tested:
// - The invitee rejects: status REJECTED, no membership, inviter notified,
//   received notification deleted
// - Inviter and a third user cannot reject; invitation stays PENDING
// - Non-PENDING invitations are refused without writing
// - An accept after reject loses: Unauthorized, no membership, no extra notifications
// - A mid-transaction failure rolls back every write
// - Rejects the call when there is no session
// - Rejects an empty, oversized, or non-string invitation id without a lookup
//
// What is covered:
// - Happy path, authorization, transaction rollback, unauthorized, invalid id
//
// Run with: pnpm test:run tests/actions/rejectInvitation.test.ts
//
// SEE: src/actions/rejectInvitation.ts

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

const { rejectInvitation } = await import('@/actions/rejectInvitation');
const { acceptInvitation } = await import('@/actions/acceptInvitation');

const inviter = { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' };
const invitee = { id: 'user-max', name: 'Maxi', username: 'maxi' };

describe('rejectInvitation', () => {
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

  it('rejects as the invitee, notifies the inviter, and deletes the received row', async () => {
    const { project, invitation } = await seedPendingInvite();

    const result = await rejectInvitation(invitation.id);

    expect(result).toEqual({ data: { id: invitation.id } });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'REJECTED' }));
    expect(db.membership.rows).toHaveLength(1);
    expect(db.membership.rows[0]).toEqual(expect.objectContaining({ userId: inviter.id }));
    expect(db.notification.rows).toEqual([
      expect.objectContaining({
        type: 'INVITATION_REJECTED',
        recipientId: inviter.id,
        invitationId: invitation.id,
        message: 'Maxi declined your invitation to Sprint board',
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it('rejects when the inviter tries to decline', async () => {
    const { invitation } = await seedPendingInvite();
    getSession.mockResolvedValue({ user: inviter });

    const result = await rejectInvitation(invitation.id);

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'PENDING' }));
    expect(db.notification.rows).toHaveLength(1);
  });

  it('rejects when a third user tries to decline', async () => {
    const { invitation } = await seedPendingInvite();
    getSession.mockResolvedValue({ user: { id: 'user-other', name: 'Other' } });

    const result = await rejectInvitation(invitation.id);

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'PENDING' }));
  });

  it('rejects a non-PENDING invitation without writing', async () => {
    const { invitation } = await seedPendingInvite();
    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    });

    const result = await rejectInvitation(invitation.id);

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.notification.rows).toHaveLength(1);
  });

  it('keeps a rejected invitation when a later accept arrives', async () => {
    const { invitation } = await seedPendingInvite();
    const membershipCountAfterSeed = db.membership.rows.length;

    const rejected = await rejectInvitation(invitation.id);
    const accepted = await acceptInvitation(invitation.id);

    expect(rejected).toEqual({ data: { id: invitation.id } });
    expect(accepted).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'REJECTED' }));
    expect(db.membership.rows).toHaveLength(membershipCountAfterSeed);
    expect(db.notification.rows).toEqual([
      expect.objectContaining({ type: 'INVITATION_REJECTED' }),
    ]);
    expect(db.notification.rows.some((row) => row.type === 'INVITATION_ACCEPTED')).toBe(false);
  });

  it('rolls back every write when notification create fails mid-transaction', async () => {
    const { invitation } = await seedPendingInvite();
    db.notification.create.mockRejectedValueOnce(new Error('write failed'));

    const result = await rejectInvitation(invitation.id);

    expect(result).toEqual({ error: GENERIC_ERROR_MESSAGE });
    expect(db.invitation.rows[0]).toEqual(expect.objectContaining({ status: 'PENDING' }));
    expect(db.notification.rows).toEqual([
      expect.objectContaining({ id: 'notif-received', type: 'INVITATION_RECEIVED' }),
    ]);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await rejectInvitation('invite-1');

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('rejects an invalid invitation id without a lookup', async () => {
    db.invitation.findFirst.mockClear();

    expect(await rejectInvitation('')).toEqual({ error: 'Unauthorized' });
    expect(await rejectInvitation('   ')).toEqual({ error: 'Unauthorized' });
    expect(await rejectInvitation('a'.repeat(MAX_ID_LENGTH + 1))).toEqual({
      error: 'Unauthorized',
    });
    expect(await rejectInvitation(1 as unknown as string)).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.findFirst).not.toHaveBeenCalled();
    expect(db.project.rows).toHaveLength(0);
  });
});
