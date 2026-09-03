'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { activityActorFromSession, recordActivityEvent } from '@/lib/activity';
import { auth } from '@/lib/auth';
import { administeredByUser, type BoardAccess } from '@/lib/membership';
import { GENERIC_ERROR_MESSAGE, MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { updateMembershipRoleSchema } from '@/lib/validation/membership';

class UnauthorizedWriteError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedWriteError';
  }
}

type MembershipRoleChange = 'ADMIN' | 'MEMBER';

type MembershipRoleSnapshot = {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  access: BoardAccess;
};

type UpdateMembershipRoleResult =
  | { data: { role: MembershipRoleChange; access: BoardAccess } }
  | { error: string; current?: MembershipRoleSnapshot };

function asMembershipRole(value: unknown): MembershipRoleSnapshot['role'] | null {
  if (value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER') {
    return value;
  }
  return null;
}

function asBoardAccess(value: unknown): BoardAccess {
  if (value === 'VIEW' || value === 'COMMENT' || value === 'EDIT') {
    return value;
  }
  return 'EDIT';
}

function asStoredAccess(value: unknown): BoardAccess | null {
  if (value === 'VIEW' || value === 'COMMENT' || value === 'EDIT') {
    return value;
  }
  return null;
}

export async function updateMembershipRole(input: {
  projectId: string;
  membershipId: string;
  role: string;
}): Promise<UpdateMembershipRoleResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updateMembershipRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const { projectId, membershipId, role } = parsed.data;

  try {
    const written = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, ...administeredByUser(session.user.id) },
      });
      if (!project) {
        throw new UnauthorizedWriteError();
      }

      const membership = await tx.membership.findFirst({
        where: { id: membershipId, projectId },
      });
      if (!membership) {
        throw new UnauthorizedWriteError();
      }
      if (membership.role === 'OWNER') {
        throw new UnauthorizedWriteError();
      }

      const currentAccess = asBoardAccess(membership.access);
      if (membership.role === role) {
        return { occupancy: false as const, role, access: currentAccess, changed: false as const };
      }

      const storedBefore = asStoredAccess(membership.accessBeforeAdmin);
      const restoredAccess = storedBefore ?? 'EDIT';
      const nextAccess: BoardAccess = role === 'ADMIN' ? 'EDIT' : restoredAccess;
      const nextBeforeAdmin: BoardAccess | null = role === 'ADMIN' ? currentAccess : null;

      const claimed = await tx.membership.updateMany({
        where: {
          id: membershipId,
          projectId,
          role: role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
          access: role === 'ADMIN' ? currentAccess : 'EDIT',
          ...(role === 'MEMBER' ? { accessBeforeAdmin: storedBefore } : {}),
          project: administeredByUser(session.user.id),
        },
        data: {
          role,
          access: nextAccess,
          accessBeforeAdmin: nextBeforeAdmin,
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.membership.findFirst({
          where: { id: membershipId, projectId },
        });
        const currentRole = asMembershipRole(current?.role);
        if (!current || !currentRole) {
          throw new UnauthorizedWriteError();
        }
        return {
          occupancy: true as const,
          role: currentRole,
          access: asBoardAccess(current.access),
          changed: false as const,
        };
      }

      const member = await tx.user.findFirst({ where: { id: String(membership.userId) } });
      if (!member) {
        throw new UnauthorizedWriteError();
      }

      await recordActivityEvent(tx, {
        projectId,
        actorId: session.user.id,
        type: role === 'ADMIN' ? 'MEMBER_PROMOTED' : 'MEMBER_DEMOTED',
        payload: {
          ...activityActorFromSession(session.user),
          memberId: String(member.id),
          memberName: String(member.name),
          memberUsername: typeof member.username === 'string' ? member.username : '',
        },
      });

      return { occupancy: false as const, role, access: nextAccess, changed: true as const };
    });

    if (written.occupancy) {
      return {
        error: MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE,
        current: { role: written.role, access: written.access },
      };
    }
    if (written.changed) {
      revalidatePath(projectPath(projectId));
    }
    return { data: { role: written.role, access: written.access } };
  } catch (error) {
    if (error instanceof UnauthorizedWriteError) {
      return { error: 'Unauthorized' };
    }
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
