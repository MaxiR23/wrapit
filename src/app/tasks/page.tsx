import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import ProjectsShell from '@/components/projects/ProjectsShell';
import MyTasksView from '@/components/tasks/MyTasksView';
import { auth } from '@/lib/auth';
import { listMyTasksForUser } from '@/lib/myTasks';
import { getNotificationsForUser } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { SIGN_IN_PATH } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'My tasks | wrapit',
};

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export default async function MyTasksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const [list, notifications] = await Promise.all([
    listMyTasksForUser(prisma, session.user.id),
    getNotificationsForUser(session.user.id),
  ]);
  const username = sessionUsername(session.user);

  return (
    <ProjectsShell
      user={{
        name: session.user.name,
        username,
      }}
      initialNotifications={notifications.items}
      activeNav="tasks"
      openTaskCount={list.openCount}
      searchPlaceholder="Search tasks"
      searchAriaLabel="Search tasks"
    >
      <MyTasksView initialTasks={list.tasks} createProjects={list.createProjects} />
    </ProjectsShell>
  );
}
