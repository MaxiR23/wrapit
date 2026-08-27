import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import ArchivedView from '@/components/archived/ArchivedView';
import ProjectsShell from '@/components/projects/ProjectsShell';
import { auth } from '@/lib/auth';
import { listArchivedProjectsForUser } from '@/lib/archivedProjectsQuery';
import { archivedCopy } from '@/lib/archivedCopy';
import { countOpenMyTasksForUser } from '@/lib/myTasks';
import { getNotificationsForUser } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { SIGN_IN_PATH } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Archived | wrapit',
};

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export default async function ArchivedProjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const [projects, notifications, openTaskCount] = await Promise.all([
    listArchivedProjectsForUser(session.user.id),
    getNotificationsForUser(session.user.id),
    countOpenMyTasksForUser(prisma, session.user.id),
  ]);
  const username = sessionUsername(session.user);

  return (
    <ProjectsShell
      user={{
        name: session.user.name,
        username,
      }}
      initialNotifications={notifications.items}
      activeNav="archived"
      openTaskCount={openTaskCount}
      searchPlaceholder={archivedCopy.projects.searchPlaceholder}
      searchAriaLabel={archivedCopy.projects.searchAriaLabel}
      mobileTitle={archivedCopy.title}
    >
      <ArchivedView initialProjects={projects} />
    </ProjectsShell>
  );
}
