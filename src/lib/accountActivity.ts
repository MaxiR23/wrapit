import {
  listActivityForActor,
  type AccountActivityEventListItem,
  type ActivityCursor,
  type ActorActivityListDb,
} from '@/lib/activity';

export type AccountProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type AccountProjectView = {
  id: string;
  title: string;
  description: string | null;
  role: AccountProjectRole;
  assignedCount: number;
};

export type AccountActivityView = {
  projects: AccountProjectView[];
  items: AccountActivityEventListItem[];
  nextCursor: ActivityCursor | null;
};

type FindMany = {
  findMany: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string>;
  }) => Promise<Array<Record<string, unknown>>>;
};

export type AccountProjectsDb = {
  membership: FindMany;
  project: FindMany;
  cardAssignee: FindMany;
  card: FindMany;
  column: FindMany;
};

const ROLE_LABEL: Record<AccountProjectRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
};

function parseRole(value: unknown): AccountProjectRole {
  if (value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER') return value;
  return 'MEMBER';
}

export function accountProjectRoleLine(role: AccountProjectRole, assignedCount: number): string {
  const cards = assignedCount === 1 ? '1 card' : `${assignedCount} cards`;
  return `${ROLE_LABEL[role]} · ${cards}`;
}

/**
 * Projects the user belongs to, with their role and how many non-archived
 * cards they are assigned there. Counts come from one assignment pass, not a
 * query per project.
 */
export async function listAccountProjectsForUser(
  db: AccountProjectsDb,
  userId: string,
): Promise<AccountProjectView[]> {
  const memberships = await db.membership.findMany({
    where: { userId },
  });
  if (memberships.length === 0) return [];

  const projectIds = memberships.map((membership) => String(membership.projectId));
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    orderBy: { createdAt: 'desc' },
  });

  const assignments = await db.cardAssignee.findMany({
    where: { userId },
  });
  const assignedCardIds = assignments.map((assignment) => String(assignment.cardId));
  const cards =
    assignedCardIds.length === 0
      ? []
      : await db.card.findMany({
          where: { id: { in: assignedCardIds }, archivedAt: null },
        });
  const columnIds = [...new Set(cards.map((card) => String(card.columnId)))];
  const columns =
    columnIds.length === 0
      ? []
      : await db.column.findMany({
          where: { id: { in: columnIds } },
        });

  const projectIdByColumnId = new Map(
    columns.map((column) => [String(column.id), String(column.projectId)]),
  );
  const memberProjectIds = new Set(projectIds);
  const counts = new Map<string, number>();
  for (const card of cards) {
    const projectId = projectIdByColumnId.get(String(card.columnId));
    if (!projectId || !memberProjectIds.has(projectId)) continue;
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
  }

  const roleByProjectId = new Map(
    memberships.map((membership) => [String(membership.projectId), parseRole(membership.role)]),
  );

  return projects.map((project) => {
    const description =
      typeof project.description === 'string' && project.description.length > 0
        ? project.description
        : null;
    return {
      id: String(project.id),
      title: String(project.title),
      description,
      role: roleByProjectId.get(String(project.id)) ?? 'MEMBER',
      assignedCount: counts.get(String(project.id)) ?? 0,
    };
  });
}

export async function getAccountActivityForUser(
  db: AccountProjectsDb & ActorActivityListDb,
  userId: string,
): Promise<AccountActivityView> {
  const projects = await listAccountProjectsForUser(db, userId);
  const page = await listActivityForActor(db, {
    actorId: userId,
    projectIds: projects.map((project) => project.id),
  });
  return { projects, items: page.items, nextCursor: page.nextCursor };
}
