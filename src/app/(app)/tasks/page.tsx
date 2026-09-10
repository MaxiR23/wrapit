import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import MyTasksView from '@/components/tasks/MyTasksView';
import { listMyTasksForUser } from '@/lib/myTasks';
import { prisma } from '@/lib/prisma';
import { SIGN_IN_PATH } from '@/lib/routes';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'My tasks | wrapit',
};

export default async function MyTasksPage() {
  const session = await getSession();
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const list = await listMyTasksForUser(prisma, session.user.id);

  return <MyTasksView initialTasks={list.tasks} createProjects={list.createProjects} />;
}
