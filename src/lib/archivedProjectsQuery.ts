import { canAdministerProject, type MembershipRole } from '@/lib/boardAccess';
import { archivedAccessibleByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import {
  parseProjectStatus,
  projectMembers,
  projectProgress,
  projectStatusLabel,
} from '@/lib/projectGrid';
import type { ArchivedPerson, ArchivedProject } from '@/lib/archived';

function asPerson(
  user: { id: string; name?: string; username?: string } | undefined,
  id: string,
): ArchivedPerson {
  return {
    id,
    name: user?.name ?? '',
    username: user?.username ?? '',
  };
}

function parseRole(value: unknown): MembershipRole {
  if (value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER') return value;
  return 'MEMBER';
}

/**
 * Archived projects the user is a member of, with progress, team, and who
 * archived them. Newest archive first.
 */
export async function listArchivedProjectsForUser(userId: string): Promise<ArchivedProject[]> {
  const projects = await prisma.project.findMany({
    where: archivedAccessibleByUser(userId),
    orderBy: [{ archivedAt: 'desc' }, { id: 'desc' }],
  });
  if (projects.length === 0) return [];

  const projectIds = projects.map((project) => project.id);
  const columns = await prisma.column.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { order: 'asc' },
  });
  const columnIds = columns.map((column) => column.id);
  const cards =
    columnIds.length === 0
      ? []
      : await prisma.card.findMany({
          where: { columnId: { in: columnIds } },
        });
  const visibleCards = cards.filter((card) => card.archivedAt == null);
  const memberships = await prisma.membership.findMany({
    where: { projectId: { in: projectIds } },
  });

  const userIds = [
    ...new Set([
      ...projects.map((project) => project.ownerId),
      ...projects.flatMap((project) => (project.archivedById ? [project.archivedById] : [])),
      ...memberships.map((membership) => membership.userId),
    ]),
  ];
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
        });
  const usersById = new Map(users.map((user) => [user.id, user]));

  return projects.flatMap((project) => {
    if (project.archivedAt == null) return [];
    const projectColumns = columns
      .filter((column) => column.projectId === project.id)
      .map((column) => ({
        ...column,
        cards: visibleCards.filter((card) => card.columnId === column.id),
      }));
    const progress = projectProgress(projectColumns);
    const status = parseProjectStatus(project.status);
    const projectMemberships = memberships.filter(
      (membership) => membership.projectId === project.id,
    );
    const owner = asPerson(usersById.get(project.ownerId), project.ownerId);
    const ownerMembership = projectMemberships.find((membership) => membership.role === 'OWNER');
    const ownerName = ownerMembership
      ? asPerson(usersById.get(ownerMembership.userId), ownerMembership.userId).name
      : owner.name;
    const myMembership = projectMemberships.find((membership) => membership.userId === userId);
    const members = projectMembers({
      owner,
      memberships: projectMemberships.map((membership) => ({
        user: asPerson(usersById.get(membership.userId), membership.userId),
      })),
    });

    return [
      {
        id: project.id,
        title: project.title,
        description: project.description ?? null,
        status,
        statusLabel: projectStatusLabel(status),
        taskCount: progress.taskCount,
        doneCount: progress.doneCount,
        percent: progress.percent,
        ownerName,
        members: members.map((member) => ({
          id: member.id,
          name: member.name,
          username: member.username,
        })),
        columns: projectColumns.map((column) => ({
          id: column.id,
          title: column.title,
          cardCount: column.cards.length,
        })),
        archivedAt: project.archivedAt,
        archivedBy: project.archivedById
          ? asPerson(usersById.get(project.archivedById), project.archivedById)
          : null,
        canAdminister: canAdministerProject(parseRole(myMembership?.role)),
      },
    ];
  });
}
