import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import ArchivedView from '@/components/archived/ArchivedView';
import ProjectsShell from '@/components/projects/ProjectsShell';
import { auth } from '@/lib/auth';
import { getArchivedCardsForUser } from '@/lib/archivedQuery';
import { archivedCopy } from '@/lib/archivedCopy';
import { canAdministerProject, type MembershipRole } from '@/lib/boardAccess';
import { countOpenMyTasksForUser } from '@/lib/myTasks';
import { getNotificationsForUser } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { getArchivedProjectForUser, listProjectMembersForUser } from '@/lib/projects';
import { ARCHIVED_PATH, SIGN_IN_PATH } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Archived | wrapit',
};

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export default async function ProjectArchivedPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const { projectId } = await params;
  const archived = await getArchivedCardsForUser(projectId, session.user.id);
  if (!archived) {
    const archivedProject = await getArchivedProjectForUser(projectId, session.user.id);
    if (archivedProject) {
      redirect(ARCHIVED_PATH);
    }
    notFound();
  }

  const [members, notifications, openTaskCount] = await Promise.all([
    listProjectMembersForUser(archived.id, session.user.id),
    getNotificationsForUser(session.user.id),
    countOpenMyTasksForUser(prisma, session.user.id),
  ]);
  const username = sessionUsername(session.user);
  const memberList = members ?? [];
  const viewer = memberList.find((member) => member.userId === session.user.id);
  const teamRole: MembershipRole = viewer?.role ?? 'MEMBER';

  return (
    <ProjectsShell
      user={{
        name: session.user.name,
        username,
      }}
      initialNotifications={notifications.items}
      activeNav="projects"
      openTaskCount={openTaskCount}
      showSearch
      searchPlaceholder={archivedCopy.searchPlaceholder}
      searchAriaLabel={archivedCopy.searchAriaLabel}
      mobileTitle={archivedCopy.title}
    >
      <ArchivedView
        projectId={archived.id}
        projectTitle={archived.title}
        initialCards={archived.cards}
        canAdminister={canAdministerProject(teamRole)}
      />
    </ProjectsShell>
  );
}
