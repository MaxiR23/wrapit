// tests/actions/createInvitation.test.ts
//
// Tests for the createInvitation server action.
//
// Tested:
// - A member (including MEMBER who is not the creator) can invite by username
// - Unknown username, self, existing member, and pending invitation all return
//   the same generic error and write nothing
// - Rejects the call when there is no session or the user is not a member
// - Returns a generic error when Prisma fails unexpectedly
// - Two overlapping first-time invites: one invitation, one notification;
//   the loser gets the generic non-invitable message
// - Rejects an empty, oversized, or non-string project id without a lookup
// - Invalid projectId wins over invalid username: Unauthorized, no query, no log
//
// What is covered:
// - Happy path, generic deny cases, authorization, unexpected Prisma failure,
//   concurrent first-time invite, invalid id
//
// Run with: pnpm test:run tests/actions/createInvitation.test.ts
//
// SEE: src/actions/createInvitation.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CANT_INVITE_USER_MESSAGE, GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { MAX_ID_LENGTH } from '@/lib/validation/id';

import { createPrismaFake } from '../helpers/prismaFake';
import { seedAccessibleProject } from '../helpers/seedAccessibleProject';

const db = createPrismaFake();
const getSession = vi.fn();
const revalidatePath = vi.fn();
const logInfo = vi.fn();

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

vi.mock('@/lib/log', () => ({ logInfo }));

const { createInvitation } = await import('@/actions/createInvitation');

const sessionUser = { id: 'user-ada', email: 'ada@example.com', name: 'Ada Lovelace' };
const invitee = { id: 'user-max', name: 'Maxi', username: 'maxi' };

describe('createInvitation', () => {
  beforeEach(async () => {
    db.reset();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: sessionUser });
    await db.user.create({
      data: { id: sessionUser.id, name: sessionUser.name, username: 'ada' },
    });
    await db.user.create({ data: invitee });
  });

  it('creates a PENDING invitation when the user is a MEMBER, not the creator', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
      ownerId: 'user-other',
      role: 'MEMBER',
    });

    const result = await createInvitation({ projectId: project.id, username: 'maxi' });

    expect(result).toEqual({
      data: expect.objectContaining({
        projectId: project.id,
        inviterId: sessionUser.id,
        inviteeId: invitee.id,
        status: 'PENDING',
        role: 'MEMBER',
      }),
    });
    expect(db.invitation.rows).toHaveLength(1);
    expect(db.notification.rows).toEqual([
      expect.objectContaining({
        type: 'INVITATION_RECEIVED',
        recipientId: invitee.id,
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${project.id}`);
  });

  it.each([
    { name: 'unknown username', username: 'nobody' },
    { name: 'self', username: 'ada' },
    { name: 'invalid username format', username: 'ab' },
  ])('returns the generic error for $name and writes nothing', async ({ username }) => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });

    const result = await createInvitation({ projectId: project.id, username });

    expect(result).toEqual({ error: CANT_INVITE_USER_MESSAGE });
    expect(db.invitation.rows).toHaveLength(0);
    expect(db.notification.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns the generic error for an existing member and writes nothing', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.membership.create({
      data: { userId: invitee.id, projectId: project.id, role: 'MEMBER', starred: false },
    });

    const result = await createInvitation({ projectId: project.id, username: 'maxi' });

    expect(result).toEqual({ error: CANT_INVITE_USER_MESSAGE });
    expect(db.invitation.rows).toHaveLength(0);
    expect(db.notification.rows).toHaveLength(0);
  });

  it('returns the generic error for a PENDING invitation and writes nothing', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    await db.invitation.create({
      data: {
        projectId: project.id,
        inviterId: sessionUser.id,
        inviteeId: invitee.id,
        status: 'PENDING',
        role: 'MEMBER',
      },
    });

    const result = await createInvitation({ projectId: project.id, username: 'maxi' });

    expect(result).toEqual({ error: CANT_INVITE_USER_MESSAGE });
    expect(db.invitation.rows).toHaveLength(1);
    expect(db.notification.rows).toHaveLength(0);
  });

  it('rejects creating when the user is not a member of the project', async () => {
    const project = await db.project.create({
      data: { title: 'Other board', ownerId: 'user-other' },
    });

    const result = await createInvitation({ projectId: project.id, username: 'maxi' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows).toHaveLength(0);
  });

  it('rejects the call when there is no session', async () => {
    getSession.mockResolvedValue(null);

    const result = await createInvitation({ projectId: 'project-1', username: 'maxi' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(db.invitation.rows).toHaveLength(0);
  });

  it('returns a generic error when Prisma fails unexpectedly', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    db.invitation.createMany.mockRejectedValueOnce(
      new Error('connection to 10.0.0.5:5432 refused'),
    );

    const result = await createInvitation({ projectId: project.id, username: 'maxi' });

    expect(result).toEqual({ error: GENERIC_ERROR_MESSAGE });
    expect(result).not.toEqual(
      expect.objectContaining({ error: expect.stringContaining('10.0.0.5') }),
    );
    expect(db.invitation.rows).toHaveLength(0);
    expect(db.notification.rows).toHaveLength(0);
  });

  it('lets only the first overlapping first-time invite succeed', async () => {
    const project = await seedAccessibleProject(db, {
      title: 'Sprint board',
      userId: sessionUser.id,
    });
    const input = { projectId: project.id, username: 'maxi' };

    const first = await createInvitation(input);
    db.invitation.findFirst.mockImplementationOnce(async () => null);
    const second = await createInvitation(input);

    expect(first).toEqual({
      data: expect.objectContaining({
        projectId: project.id,
        inviteeId: invitee.id,
        status: 'PENDING',
      }),
    });
    expect(second).toEqual({ error: CANT_INVITE_USER_MESSAGE });
    expect(second).not.toEqual({ error: GENERIC_ERROR_MESSAGE });
    expect(db.invitation.rows).toHaveLength(1);
    expect(db.notification.rows).toHaveLength(1);
    expect(db.notification.rows[0]).toEqual(
      expect.objectContaining({ type: 'INVITATION_RECEIVED' }),
    );
  });

  it('rejects an invalid project id without a lookup', async () => {
    db.project.findFirst.mockClear();

    const empty = await createInvitation({ projectId: '', username: 'maxi' });
    expect(empty).toEqual({ error: 'Unauthorized' });
    expect(empty).not.toEqual({ error: CANT_INVITE_USER_MESSAGE });
    expect(await createInvitation({ projectId: '   ', username: 'maxi' })).toEqual({
      error: 'Unauthorized',
    });
    expect(
      await createInvitation({ projectId: 'a'.repeat(MAX_ID_LENGTH + 1), username: 'maxi' }),
    ).toEqual({ error: 'Unauthorized' });
    expect(await createInvitation({ projectId: 1 as unknown as string, username: 'maxi' })).toEqual(
      {
        error: 'Unauthorized',
      },
    );
    expect(db.project.findFirst).not.toHaveBeenCalled();
    expect(db.invitation.rows).toHaveLength(0);
    expect(db.notification.rows).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects when both projectId and username are invalid without a lookup or log', async () => {
    db.project.findFirst.mockClear();
    const oversized = 'a'.repeat(MAX_ID_LENGTH + 1);

    const result = await createInvitation({ projectId: oversized, username: 'ab' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(result).not.toEqual({ error: CANT_INVITE_USER_MESSAGE });
    expect(db.project.findFirst).not.toHaveBeenCalled();
    expect(db.invitation.rows).toHaveLength(0);
    expect(logInfo).not.toHaveBeenCalled();
    expect(JSON.stringify(logInfo.mock.calls)).not.toContain(oversized);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
