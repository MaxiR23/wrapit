import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import ProjectsShell from '@/components/projects/ProjectsShell';
import { countOpenMyTasksForUser } from '@/lib/myTasks';
import { getUnreadNotificationCountForUser } from '@/lib/notifications';
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

  const [unreadCount, openTaskCount] = await Promise.all([
    getUnreadNotificationCountForUser(session.user.id),
    countOpenMyTasksForUser(prisma, session.user.id),
  ]);

  return (
    <ProjectsShell
      user={{
        name: session.user.name,
        username: sessionUsername(session.user),
      }}
      initialUnreadCount={unreadCount}
      openTaskCount={openTaskCount}
    >
      {children}
    </ProjectsShell>
  );
}
