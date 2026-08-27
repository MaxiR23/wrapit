type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type BoardAccess = 'EDIT' | 'COMMENT' | 'VIEW';

const ACCESS_RANK: Record<BoardAccess, number> = {
  VIEW: 0,
  COMMENT: 1,
  EDIT: 2,
};

const BOARD_ACCESSES: BoardAccess[] = ['VIEW', 'COMMENT', 'EDIT'];

function accessesAtLeast(min: BoardAccess): BoardAccess[] {
  const rank = ACCESS_RANK[min];
  return BOARD_ACCESSES.filter((access) => ACCESS_RANK[access] >= rank);
}

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

type CardAssigneeTx = {
  cardAssignee: {
    deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>;
  };
};

/** Prisma Project where: the user has any Membership on a live project. */
export function accessibleByUser(userId: string): {
  archivedAt: null;
  memberships: { some: { userId: string } };
} {
  return { archivedAt: null, memberships: { some: { userId } } };
}

/** Prisma Project where: the user has board access at least `min` on a live project. */
export function withBoardAccess(
  userId: string,
  min: BoardAccess,
): {
  archivedAt: null;
  memberships: { some: { userId: string; access: { in: BoardAccess[] } } };
} {
  return {
    archivedAt: null,
    memberships: { some: { userId, access: { in: accessesAtLeast(min) } } },
  };
}

/** Prisma Project where: the user is OWNER or ADMIN of a live project. */
export function administeredByUser(userId: string): {
  archivedAt: null;
  memberships: { some: { userId: string; role: { in: MembershipRole[] } } };
} {
  return {
    archivedAt: null,
    memberships: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } },
  };
}

/** Prisma Project where: the user has any Membership on an archived project. */
export function archivedAccessibleByUser(userId: string): {
  archivedAt: { not: null };
  memberships: { some: { userId: string } };
} {
  return { archivedAt: { not: null }, memberships: { some: { userId } } };
}

/** Prisma Project where: the user is OWNER or ADMIN of an archived project. */
export function archivedAdministeredByUser(userId: string): {
  archivedAt: { not: null };
  memberships: { some: { userId: string; role: { in: MembershipRole[] } } };
} {
  return {
    archivedAt: { not: null },
    memberships: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } },
  };
}

/**
 * Prisma Project where: an OWNER membership other than `membershipId` exists.
 * Compose into a delete so two concurrent last-owner removals cannot land on zero.
 */
export function remainingOwnerOnProject(membershipId: string): {
  memberships: { some: { role: 'OWNER'; id: { not: string } } };
} {
  return { memberships: { some: { role: 'OWNER', id: { not: membershipId } } } };
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
  db: {
    membership: {
      findFirst: (args: {
        where: Record<string, unknown>;
      }) => Promise<Record<string, unknown> | null>;
      count: (args: { where: Record<string, unknown> }) => Promise<number>;
    };
  },
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
 * Drop CardAssignee rows for this user on this project's cards. Cards stay.
 * Shared by leave and remove so both departures unassign the same way.
 */
export async function unassignUserFromProject(
  tx: CardAssigneeTx,
  input: { userId: string; projectId: string },
): Promise<void> {
  await tx.cardAssignee.deleteMany({
    where: {
      userId: input.userId,
      card: { column: { projectId: input.projectId } },
    },
  });
}

/**
 * Ensure every Project has an OWNER Membership.
 * Skips a project that already has an OWNER so a transfer cannot be undone.
 * Otherwise promotes the creator row, then inserts where none exists.
 * Keep in sync with prisma/migrations/*_backfill_owner_memberships.
 */
export async function backfillOwnerMemberships(db: MembershipDb): Promise<void> {
  const projects = await db.project.findMany();
  for (const project of projects) {
    const projectId = String(project.id);
    const existingOwner = await db.membership.findFirst({
      where: { projectId, role: 'OWNER' },
    });
    if (existingOwner) {
      continue;
    }

    const ownerId = String(project.ownerId);
    const existing = await db.membership.findFirst({
      where: { projectId, userId: ownerId },
    });
    if (existing) {
      await db.membership.update({
        where: { id: String(existing.id) },
        data: { role: 'OWNER' },
      });
      continue;
    }

    await db.membership.create({
      data: {
        userId: ownerId,
        projectId,
        role: 'OWNER' satisfies MembershipRole,
        access: 'EDIT' satisfies BoardAccess,
        starred: false,
      },
    });
  }
}
