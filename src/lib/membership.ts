type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

type MembershipDb = {
  membership: {
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<Record<string, unknown> | null>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  project: {
    findMany: (args?: object) => Promise<Array<Record<string, unknown>>>;
  };
};

/** Prisma Project where: the user has any Membership on the project. */
export function accessibleByUser(userId: string): {
  memberships: { some: { userId: string } };
} {
  return { memberships: { some: { userId } } };
}

export class LastOwnerError extends Error {
  constructor() {
    super('Cannot remove the last OWNER');
    this.name = 'LastOwnerError';
  }
}

/**
 * Throws when `membershipId` is the last OWNER on the project.
 * No-ops when the row is missing or is not OWNER. Does not write.
 */
export async function assertNotLastOwner(
  db: Pick<MembershipDb, 'membership'>,
  input: { projectId: string; membershipId: string },
): Promise<void> {
  const membership = await db.membership.findFirst({
    where: { id: input.membershipId, projectId: input.projectId },
  });
  if (!membership || membership.role !== 'OWNER') {
    return;
  }

  const remaining = await db.membership.count({
    where: {
      projectId: input.projectId,
      role: 'OWNER',
      id: { not: input.membershipId },
    },
  });
  if (remaining === 0) {
    throw new LastOwnerError();
  }
}

/**
 * Ensure every Project has an OWNER Membership for its current ownerId.
 * Promotes a creator non-OWNER row, then inserts where none exists.
 * Keep in sync with prisma/migrations/*_backfill_owner_memberships.
 */
export async function backfillOwnerMemberships(db: MembershipDb): Promise<void> {
  const projects = await db.project.findMany();
  for (const project of projects) {
    const projectId = String(project.id);
    const ownerId = String(project.ownerId);
    const existing = await db.membership.findFirst({
      where: { projectId, userId: ownerId },
    });
    if (existing) {
      if (existing.role !== 'OWNER') {
        await db.membership.update({
          where: { id: String(existing.id) },
          data: { role: 'OWNER' },
        });
      }
      continue;
    }

    await db.membership.create({
      data: {
        userId: ownerId,
        projectId,
        role: 'OWNER' satisfies MembershipRole,
        starred: false,
      },
    });
  }
}
