import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import ProjectsShell from '@/components/projects/ProjectsShell';
import { countOpenMyTasksForUser } from '@/lib/myTasks';
import { getNotificationsForUser } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { SIGN_IN_PATH } from '@/lib/routes';
import { getSession } from '@/lib/session';

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const [notifications, openTaskCount] = await Promise.all([
    getNotificationsForUser(session.user.id),
    countOpenMyTasksForUser(prisma, session.user.id),
  ]);

  return (
    <ProjectsShell
      user={{
        name: session.user.name,
        username: sessionUsername(session.user),
      }}
      initialNotifications={notifications.items}
      openTaskCount={openTaskCount}
    >
      {children}
    </ProjectsShell>
  );
}
